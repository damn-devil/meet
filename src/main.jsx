import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((reg) => {
      let first = true
      const check = (worker) => {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') {
            // есть старая версия (controller) — значит это обновление, а не первая установка
            if (!first) window.dispatchEvent(new CustomEvent('together-update-available'))
            first = false
          }
        })
      }
      if (reg.installing) check(reg.installing)
      reg.addEventListener('updatefound', () => {
        if (reg.installing) check(reg.installing)
      })
    }).catch(() => {})
  })
}
