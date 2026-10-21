import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../mobile.css';

// React monta el recorrido completo existente mientras sus pantallas se
// convierten gradualmente en componentes, sin perder ninguna experiencia.
function EsoVuelaApp() {
  useEffect(() => {
    if (window.__esoVuelaLegacyLoaded) return undefined;
    window.__esoVuelaLegacyLoaded = true;
    const script = document.createElement('script');
    script.src = new URL('../mobile.js', import.meta.url).href;
    script.async = false;
    document.body.appendChild(script);
    return () => {
      script.remove();
      window.__esoVuelaLegacyLoaded = false;
    };
  }, []);

  return <main className="entry"><p className="kicker">CARGANDO EXPERIENCIA</p><h1>Eso Vuela</h1></main>;
}

createRoot(document.getElementById('app')).render(<EsoVuelaApp />);
