# EsoVuela · prototipo HTML funcional

Propuesta mobile-first independiente de la estética del benchmark. La experiencia empieza con la elección de 6, 12 o 30 huevos, muestra siempre el precio por unidad y permite completar un pedido de prueba en tres pasos: contacto, entrega y revisión. Incluye carrito, confirmación, historial, recompra, calculadora de consumo, ayuda por WhatsApp y asistente conversacional.

## Abrir el prototipo

Abre `index.html` en un navegador. El carrito, los pedidos de prueba, la recompra y la calculadora funcionan sin instalar nada. Para utilizar el asistente con un LLM, inicia el servidor local desde esta carpeta:

```powershell
node server.js
```

Después abre `http://127.0.0.1:4173`. Se requiere Node.js 18 o posterior.

## Backend funcional

El servidor ahora expone una API REST local en la misma dirección. No necesita instalar paquetes:

```powershell
cd codex
npm start
```

Rutas principales:

- `POST /api/auth/register` y `POST /api/auth/login`: clientes y comercios, con contraseñas derivadas con PBKDF2.
- `GET /api/auth/me` y `PATCH /api/me/reminders`: sesión y consentimiento de recordatorios.
- `GET /api/catalog`, `POST /api/orders`, `GET /api/orders` y `PATCH /api/orders/:id/status`: catálogo, pedidos y seguimiento.
- `POST /api/game/play`: una selección entre cuatro huevos por oportunidad. El servidor consume la oportunidad y acredita los puntos; el navegador no decide el resultado.
- `POST /api/redemptions` y `POST /api/ratings`: canjes que descuentan puntos y calificaciones.

El catálogo de la pantalla inicial se consulta con `GET /api/catalog/home`. Sus productos están en `data/catalog.sqlite`, con categoría, nombre, presentación, precio, imagen, orden y estado de publicación. La API solo devuelve productos activos.

Las solicitudes privadas usan `Authorization: Bearer <token>`. Para desarrollo los datos se guardan en `data/esovuela.json`; esa carpeta se crea al primer registro y no debe subirse a Git. En AWS no se debe usar ese archivo como base de datos: usa DynamoDB o RDS y guarda `DATA_DIR`, credenciales y secretos fuera del repositorio. WhatsApp, pagos y GPS siguen sin integración real.

## React + Node.js + MongoDB

La interfaz de usuario está ahora en React (`src/main.jsx`) y llama a la API Node.js mediante `/api`. El catálogo, las cuentas, los pedidos y el juego se persisten en MongoDB cuando `MONGODB_URI` está configurada.

Para desarrollo usa dos terminales desde esta carpeta:

```powershell
npm.cmd run dev:api
npm.cmd run dev
```

Abre la URL que indique Vite (normalmente `http://localhost:5173`). Para ejecutar una versión integrada, compila y sirve React desde Node:

```powershell
npm.cmd run build
npm.cmd start
```

El archivo `.env` se carga automáticamente. Copia `example.env` y, para MongoDB local, usa `MONGODB_URI=mongodb://127.0.0.1:27017`.

## MongoDB

El backend puede operar completamente con MongoDB. Configura `MONGODB_URI` y, opcionalmente, `MONGODB_DB=esovuela`; al iniciar `node server.js`, usa automáticamente MongoDB para catálogo, cuentas, pedidos, puntos, canjes y calificaciones. El catálogo se crea con los productos iniciales si la colección `products` está vacía.

Para copiar los datos existentes de SQLite y JSON hacia MongoDB:

```powershell
$env:MONGODB_URI="tu-cadena-de-conexion"
$env:MONGODB_DB="esovuela"
npm.cmd run migrate:mongo
```

No pegues la cadena de conexión real en el código, GitHub o capturas. Copia `example.env` a `.env` únicamente como referencia local; Node no carga ese archivo automáticamente.

## Conectar la IA

Configura `OPENAI_API_KEY` como variable de entorno del servidor y vuelve a iniciar `node server.js`. La clave permanece en el servidor; no se envía al navegador. El servidor llama a la [Responses API de OpenAI](https://developers.openai.com/api/docs/guides/text). El modelo predeterminado es `gpt-6-luna`, modificable con `OPENAI_MODEL`. Sin clave, el asistente responde con ejemplos locales.

El asistente solo recibe la pregunta, las últimas intervenciones de la conversación y las preferencias de consumo. No recibe los datos del checkout. El servidor omite correos y teléfonos escritos en la consulta.

## Antes de publicar

- Los precios de 6, 12 y 30 huevos y la tarifa de entrega son **de muestra**. Se editan en `mobile.js` (`PRODUCTS` y `CONFIG`). La comparación de ahorro en inicio usa esos mismos precios de muestra.
- El número oficial de WhatsApp se configura en `CONFIG.whatsappNumber` de `mobile.js`, con indicativo internacional y sin `+`. Si está vacío, WhatsApp permite elegir un contacto al compartir el mensaje.
- Cobertura, horarios, inventario, método de pago y condiciones de promociones necesitan confirmación comercial.
- Los pedidos y datos de contacto de esta demostración se guardan solamente en `localStorage`. No se envían pedidos ni mensajes automáticos, ni se cobran pagos.

La propuesta de diseño móvil y sus decisiones se resumen en `PROPUESTA_MOVIL.md`.

Vistas previas a 375 px: `vista-mobile-inicio.png`, `vista-mobile-catalogo.png` y `vista-mobile-compra.png`.
