import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './index.css'
import App from './App.tsx'
import './style/chat.css'
import './style/menu.css'
import './style/helpmodal.css'
import './style/configmodel.css'
import './style/supportmodal.css'
import './style/notFound.css'
import './style/developermodal.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
