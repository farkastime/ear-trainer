import { registerSW } from 'virtual:pwa-register'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useAppStore } from './state/store'
import { App } from './ui/App'
import { AudioProvider } from './ui/AudioContext'
import './ui/styles.css'

registerSW({ immediate: true })

declare global {
  interface Window {
    __earTrainer: typeof useAppStore
  }
}
window.__earTrainer = useAppStore

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AudioProvider>
      <App />
    </AudioProvider>
  </StrictMode>,
)
