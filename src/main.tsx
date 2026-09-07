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
import './style/developerModal.css'
import './style/jarvishud.css'
import './style/loading.css'

// StrictMode foi removido de propósito: em desenvolvimento ele monta cada
// componente duas vezes (mount → unmount → mount) para detectar efeitos
// colaterais, e isso faz o react-three-fiber tentar criar dois contextos
// WebGL quase ao mesmo tempo para o mesmo <Canvas>. Em GPUs integradas/mais
// fracas isso derruba o contexto ("Context Lost") e a cena nunca renderiza.
// É um problema conhecido de r3f + StrictMode, não do nosso código de cena.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)