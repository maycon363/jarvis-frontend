// src/pages/NotFound.tsx
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { GlitchingParticleSphere } from "../components/GlitchingParticleSphere";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="notfound-container">
      <div className="notfound-bg">
        <Canvas>
        <ambientLight intensity={0.1} />
            <pointLight position={[10, 10, 10]} intensity={1.5} />
            <GlitchingParticleSphere />
        </Canvas>
      </div>

      <div className="notfound-content">
        <h1>404</h1>
        <h2 className="typewriter-loop">
            <span>Rota não encontrada</span>
        </h2>
        <p>
          <span className="jarvis">J.A.R.V.I.S:</span> Caro usuário, esta área não existe no sistema. 
          Recomendo retornar imediatamente.
        </p>
        <button onClick={() => navigate("/jarvis-frontend/")}>
          ⬅ Voltar para o JARVIS
        </button>
      </div>
    </div>
  );
}
