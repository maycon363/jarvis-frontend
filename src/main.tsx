import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './style/chat.css'
import './style/menu.css'
import './style/helpmodal.css'
import './style/configmodel.css'
import './style/supportmodal.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
