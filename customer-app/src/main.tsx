import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppNotificationHost } from './components/AppNotificationHost.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppNotificationHost />
    <App />
  </StrictMode>,
)
