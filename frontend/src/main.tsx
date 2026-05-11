import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSession } from './lib/api.ts'

// Obtiene el token de sesión antes de renderizar.
// La app se muestra igualmente aunque falle (SESSION_ENABLED=false en .env del server).
initSession().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
