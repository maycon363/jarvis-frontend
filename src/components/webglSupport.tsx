// webglSupport.tsx
// Utilitário compartilhado pelos 3 modos visuais (Modelo 3D, Holograma,
// Esfera) — detecta se o navegador consegue de fato criar um contexto
// WebGL ANTES de tentar montar um <Canvas> do three.js. Isso evita o crash
// "WebGL context could not be created" que acontece quando a GPU está
// desabilitada/sandboxed (comum em VMs, containers, alguns webviews
// embutidos, ou aceleração de hardware desligada no navegador). É um
// bloqueio do AMBIENTE do usuário — nenhum componente React consegue
// contornar isso, só evitar o crash e mostrar um fallback decente.

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

// ─── Fallback 100% CSS (sem WebGL) — pulso ciano genérico, reaproveitado
// pelos 3 modos visuais quando a GPU está indisponível. ─────────────────────
export function WebGLUnavailableFallback({ label }: { label: string }) {
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 10,
      }}
    >
      <div
        style={{
          width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #4dd8ff 0%, #0d5a73 55%, #051820 100%)',
          boxShadow: '0 0 40px 6px rgba(34,211,238,0.45)',
          animation: 'jarvis-orb-pulse 2.4s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes jarvis-orb-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.9; }
          50%      { transform: scale(1.06); opacity: 1;   }
        }
      `}</style>
      <span style={{ color: '#5fd8ff', fontFamily: 'monospace', fontSize: 11, opacity: 0.75, textAlign: 'center', maxWidth: 240 }}>
        {label} indisponível — aceleração de hardware (WebGL) desativada neste navegador/ambiente.
      </span>
    </div>
  );
}