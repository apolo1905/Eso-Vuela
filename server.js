// Servidor local opcional: sirve el HTML y conecta el asistente con OpenAI.
// No requiere dependencias externas. Node.js 18 o posterior.
const http = require("node:http");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { api } = require('./backend');
const { mongoApi } = require('./mongo-backend');

const ROOT = __dirname;
// Lee .env en desarrollo. Las variables definidas por el sistema prevalecen.
const envFile = path.join(ROOT, '.env');
if (fsSync.existsSync(envFile)) {
  for (const line of fsSync.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
const PORT = Number(process.env.PORT) || 4173;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const ALLOWED_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/mobile.css", ["mobile.css", "text/css; charset=utf-8"]],
  ["/mobile.js", ["mobile.js", "text/javascript; charset=utf-8"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
]);
const handleBackend = process.env.MONGODB_URI ? mongoApi() : api(ROOT);

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 20000) throw new Error("too_large");
  }
  return JSON.parse(text);
}

function cleanText(value, limit = 450) {
  return String(value || "")
    .slice(0, limit)
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[correo omitido]")
    .replace(/(?:\+?\d[\s().-]*){10,}/g, "[teléfono omitido]");
}

function buildInput(body) {
  const rhythm = body.rhythm || {};
  const persons = Math.min(10, Math.max(1, Number(rhythm.persons) || 2));
  const stock = Math.min(90, Math.max(0, Number(rhythm.stock) || 0));
  const rate = ["tranquilo", "diario", "intenso"].includes(rhythm.rate) ? rhythm.rate : "diario";
  const history = Array.isArray(body.history) ? body.history.slice(-6).map(message => `${message.role === "bot" ? "Eso" : "Cliente"}: ${cleanText(message.text, 450)}`).join("\n") : "";
  return `Contexto de compra (valores elegidos en el prototipo): ${persons} personas, ${stock} huevos disponibles, frecuencia ${rate}.\nCatálogo de muestra: 6 huevos $5.900 COP, 12 huevos $10.900 COP, 30 huevos $25.900 COP.\nHistorial reciente:\n${history}\nPregunta actual: ${cleanText(body.question)}`;
}

async function askOpenAI(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        instructions: "Eres Eso, asistente de compra de EsoVuela en Colombia. Responde en español claro y cercano. Ayuda a elegir entre presentaciones de 6, 12 y 30 huevos; estima consumo y sugiere ideas sencillas de desayuno si te lo piden. Usa solo los precios del contexto y di que son de muestra. No inventes disponibilidad, cobertura, horarios confirmados ni promociones. No confirmes pedidos, pagos o envíos. Nunca conviertas un recordatorio en una compra automática. Evita solicitar datos personales. Si falta información, haz una pregunta corta. Responde en máximo 90 palabras, con cifras concretas cuando sea útil.",
        input: buildInput(body),
        reasoning: { effort: "low" },
        max_output_tokens: 400,
        store: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`openai_${response.status}`);
    const data = await response.json();
    const answer = (data.output || []).flatMap(item => item.content || []).filter(part => part.type === "output_text").map(part => part.text).join("\n").trim();
    if (!answer) throw new Error("empty_output");
    return answer;
  } finally { clearTimeout(timer); }
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = new URL(req.url, "http://localhost").pathname; } catch { return json(res, 400, { error: "Ruta inválida" }); }

  try { const handled = await handleBackend(req, res, pathname); if (handled !== false) return; } catch (error) { console.error("API:", error.message); return json(res, error.message === "too_large" ? 413 : 400, { error: "No fue posible procesar la solicitud." }); }

  if (pathname === "/api/status" && req.method === "GET") return json(res, 200, { llmConnected: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_API_KEY ? MODEL : null });

  if (pathname === "/api/assistant" && req.method === "POST") {
    if (!process.env.OPENAI_API_KEY) return json(res, 503, { error: "LLM no configurado" });
    try {
      const body = await readBody(req);
      if (typeof body.question !== "string" || !body.question.trim()) return json(res, 400, { error: "Escribe una pregunta" });
      const answer = await askOpenAI(body);
      return json(res, 200, { answer });
    } catch (error) {
      console.error("Asistente:", error.message);
      return json(res, error.message === "too_large" ? 413 : 502, { error: "El asistente no está disponible en este momento" });
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Método no permitido" });
  // El build de Vite se sirve desde Node para producción.
  const dist = path.join(ROOT, 'dist');
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(dist, relative);
  const target = candidate.startsWith(`${dist}${path.sep}`) ? candidate : path.join(dist, 'index.html');
  try {
    let file = target;
    try { await fs.access(file); } catch { file = path.join(dist, 'index.html'); }
    const mime = ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream';
    const contents = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : contents);
  } catch { json(res, 503, { error: "Frontend no compilado. Ejecuta npm.cmd run build." }); }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`EsoVuela listo en http://127.0.0.1:${PORT}`);
  console.log(`Asistente: ${process.env.OPENAI_API_KEY ? `IA conectada (${MODEL})` : "modo demostración local"}`);
});
