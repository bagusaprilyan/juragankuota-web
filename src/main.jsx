import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

/* GitHub Pages SPA fallback: 404.html menyimpan path asli ke sessionStorage,
   lalu redirect ke '/'. Di sini kita pulihkan path-nya supaya React Router
   bisa langsung membuka halaman yang dimaksud (mis. /order/BYU10). */
try {
  const saved = sessionStorage.getItem('spa_redirect')
  if (saved && saved !== '/' && window.location.pathname === '/') {
    sessionStorage.removeItem('spa_redirect')
    window.history.replaceState(null, '', saved)
  }
} catch (e) {
  /* abaikan */
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// Registrasi Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW opsional — abaikan bila gagal */
    })
  })
}
