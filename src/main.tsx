import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeRepository } from './services/clientRepository'
import { App } from './App'
import './styles.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined))
}

const root = createRoot(document.getElementById('root')!)
root.render(<main className="app-shell"><h1>TAT.</h1><p>Abriendo tus clientes y visitas…</p></main>)
initializeRepository().then(() => root.render(<StrictMode><App /></StrictMode>)).catch(error => {
  root.render(<main className="app-shell"><h1>TAT.</h1><p role="alert">{error instanceof Error ? error.message : 'No se pudieron abrir tus datos.'}</p><p>No borres los datos del navegador. Cierra otras pestañas e inténtalo de nuevo.</p><button className="primary-action" onClick={() => location.reload()}>Reintentar</button></main>)
})
