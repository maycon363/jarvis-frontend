// MetalOrb.tsx
import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor, AdaptiveDpr } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { isWebGLAvailable, WebGLUnavailableFallback } from './webglSupport';

interface Props {
  speaking:        boolean;
  recognizing:     boolean;
  error:           boolean;
  bloomIntensity?: number;
}

const STATE_COLOR = {
  idle:      new THREE.Color(0x22d3ee), // Ciano
  listening: new THREE.Color(0x4488ff), // Azul
  speaking:  new THREE.Color(0x00ff88), // Verde
  error:     new THREE.Color(0xff3322), // Vermelho
} as const;

function targetColor(speaking: boolean, recognizing: boolean, error: boolean) {
  return error ? STATE_COLOR.error
    : speaking ? STATE_COLOR.speaking
    : recognizing ? STATE_COLOR.listening
    : STATE_COLOR.idle;
}

// ─── PRNG determinístico ──────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Entrada: escala com "estouro" elástico + giro que desacelera. Só isso
// foi adicionado — nenhuma outra parte do arquivo foi tocada. ──────────────
const STEADY_SCALE       = 0.20; // mesmo valor que já estava fixo no scale do group
const SHELL_POP_DURATION = 1.0;
const SHELL_SPIN_DECAY   = 1.4;

function easeOutBack(x: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  const t = THREE.MathUtils.clamp(x, 0, 1) - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}

// ─── Geração de Texturas Procedurais (Painéis + Mapa Emissivo) ─────────────
let _panelMap: THREE.Texture | null = null;
let _panelBump: THREE.Texture | null = null;
let _panelEmissive: THREE.Texture | null = null;

function getPanelTextures(): { map: THREE.Texture; bump: THREE.Texture; emissiveMap: THREE.Texture } {
  if (_panelMap && _panelBump && _panelEmissive) {
    return { map: _panelMap, bump: _panelBump, emissiveMap: _panelEmissive };
  }

  const W = 2048, H = 1024;
  const rand = mulberry32(1337);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W; colorCanvas.height = H;
  const cctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W; bumpCanvas.height = H;
  const bctx = bumpCanvas.getContext('2d')!;

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = W; emissiveCanvas.height = H;
  const ectx = emissiveCanvas.getContext('2d')!;

  // Fundos base
  cctx.fillStyle = '#10161b';
  cctx.fillRect(0, 0, W, H);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000000'; // Emissivo base totalmente preto
  ectx.fillRect(0, 0, W, H);

  // Grade de painéis
  const cols = 16, rows = 9;
  const colX: number[] = [0];
  for (let i = 1; i < cols; i++) colX.push((i / cols) * W + (rand() - 0.5) * (W / cols) * 0.4);
  colX.push(W);
  const rowY: number[] = [0];
  for (let i = 1; i < rows; i++) rowY.push((i / rows) * H + (rand() - 0.5) * (H / rows) * 0.4);
  rowY.push(H);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = colX[c], x1 = colX[c + 1];
      const y0 = rowY[r], y1 = rowY[r + 1];
      const shade = 18 + Math.floor(rand() * 14);

      cctx.fillStyle = `rgb(${shade + 4}, ${shade + 10}, ${shade + 16})`;
      cctx.fillRect(x0, y0, x1 - x0, y1 - y0);

      const bShade = 110 + Math.floor(rand() * 50);
      bctx.fillStyle = `rgb(${bShade},${bShade},${bShade})`;
      bctx.fillRect(x0, y0, x1 - x0, y1 - y0);

      // Volume nos painéis
      const grad = cctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, 'rgba(255,255,255,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0.15)');
      cctx.fillStyle = grad;
      cctx.fillRect(x0, y0, x1 - x0, y1 - y0);

      // Rebites
      if (rand() > 0.5) {
        const pad = 10;
        [[x0 + pad, y0 + pad], [x1 - pad, y0 + pad], [x0 + pad, y1 - pad], [x1 - pad, y1 - pad]].forEach(([rx, ry]) => {
          cctx.beginPath();
          cctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
          cctx.fillStyle = 'rgba(200,210,220,0.35)';
          cctx.fill();

          bctx.beginPath();
          bctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
          bctx.fillStyle = 'rgba(255,255,255,0.9)';
          bctx.fill();
        });
      }
    }
  }

  // Costuras entre placas
  cctx.strokeStyle = 'rgba(0,0,0,0.7)';
  cctx.lineWidth = 3;
  bctx.strokeStyle = 'rgba(0,0,0,0.95)';
  bctx.lineWidth = 3;

  for (let c = 1; c < cols; c++) {
    cctx.beginPath(); cctx.moveTo(colX[c], 0); cctx.lineTo(colX[c], H); cctx.stroke();
    bctx.beginPath(); bctx.moveTo(colX[c], 0); bctx.lineTo(colX[c], H); bctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    cctx.beginPath(); cctx.moveTo(0, rowY[r]); cctx.lineTo(W, rowY[r]); cctx.stroke();
    bctx.beginPath(); bctx.moveTo(0, rowY[r]); bctx.lineTo(W, rowY[r]); bctx.stroke();
  }

  // ─── Trilhas de Circuitos Futuristícos (Canais Emissivos) ───────────────
  ectx.strokeStyle = '#ffffff';
  ectx.lineWidth = 3.5;
  ectx.lineCap = 'round';
  ectx.lineJoin = 'round';

  const circuitCount = 14;
  for (let n = 0; n < circuitCount; n++) {
    let x = rand() * W;
    let y = rowY[Math.floor(rand() * rows)];
    const segments = 4 + Math.floor(rand() * 6);

    ectx.beginPath();
    ectx.moveTo(x, y);

    for (let s = 0; s < segments; s++) {
      const dir = Math.floor(rand() * 4);
      const dist = 30 + rand() * 90;

      if (dir === 0) x += dist;
      else if (dir === 1) x -= dist;
      else if (dir === 2) y += dist;
      else y -= dist;

      ectx.lineTo(x, y);
    }
    ectx.stroke();

    // Nós/Conectores circulares no final das trilhas
    ectx.beginPath();
    ectx.arc(x, y, 5, 0, Math.PI * 2);
    ectx.fillStyle = '#ffffff';
    ectx.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;

  _panelMap = map;
  _panelBump = bump;
  _panelEmissive = emissiveMap;

  return { map, bump, emissiveMap };
}

/* ── Casca metálica PBR com linhas emissivas dinâmicas ─────────────────────── */
function MetalShell({ speaking, recognizing, error }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const { map, bump, emissiveMap } = useMemo(() => getPanelTextures(), []);

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      const spin = speaking ? 0.16 : recognizing ? 0.1 : 0.045;
      groupRef.current.rotation.y += delta * spin;
      groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.12) * 0.05;
    }

    if (matRef.current) {
      // Transição suave de cor do circuito conforme estado do JARVIS
      const currentColor = targetColor(speaking, recognizing, error);
      matRef.current.emissive.lerp(currentColor, 0.06);

      // Pulsação sutil na intensidade do brilho
      const pulse = speaking
        ? 2.5 + Math.sin(clock.elapsedTime * 8) * 0.8
        : recognizing
        ? 2.0 + Math.sin(clock.elapsedTime * 4) * 0.5
        : 1.5 + Math.sin(clock.elapsedTime * 1.5) * 0.2;

      matRef.current.emissiveIntensity = pulse;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <meshPhysicalMaterial
          ref={matRef}
          map={map}
          bumpMap={bump}
          bumpScale={0.008}
          emissiveMap={emissiveMap}
          emissive={STATE_COLOR.idle}
          emissiveIntensity={1.5}
          metalness={0.95}
          roughness={0.28}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
          envMapIntensity={1.3}
        />
      </mesh>
    </group>
  );
}

/* ── Olho/Núcleo central fixo de frente pra câmera ──────────────────────── */
function EyeCore({ speaking, recognizing, error }: Props) {
  const groupRef  = useRef<THREE.Group>(null);
  const glowRef   = useRef<THREE.MeshBasicMaterial>(null);
  const coreRef   = useRef<THREE.MeshBasicMaterial>(null);
  const ring1Ref  = useRef<THREE.MeshBasicMaterial>(null);
  const ring2Ref  = useRef<THREE.MeshBasicMaterial>(null);
  const coreMesh  = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    const c = targetColor(speaking, recognizing, error);
    glowRef.current?.color.lerp(c, 0.06);
    ring1Ref.current?.color.lerp(c, 0.06);
    ring2Ref.current?.color.lerp(c, 0.06);
    if (coreRef.current) coreRef.current.color.lerp(new THREE.Color(0xffffff).lerp(c, 0.3), 0.06);

    if (groupRef.current) {
      const spin = speaking ? 0.5 : recognizing ? 0.28 : 0.08;
      groupRef.current.rotation.z += delta * spin;
    }
    if (coreMesh.current) {
      const t = clock.elapsedTime;
      const pulse = speaking ? 1 + Math.sin(t * 7) * 0.12 : recognizing ? 1 + Math.sin(t * 3.5) * 0.06 : 1 + Math.sin(t * 1.4) * 0.03;
      coreMesh.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 1.001]}>
      {/* Bezel de metal escuro */}
      <mesh>
        <torusGeometry args={[0.34, 0.045, 20, 64]} />
        <meshStandardMaterial color="#0a1014" metalness={1} roughness={0.35} />
      </mesh>
      {/* Anéis de íris */}
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[0.29, 0.305, 64]} />
        <meshBasicMaterial ref={ring1Ref} color={STATE_COLOR.idle} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <ringGeometry args={[0.19, 0.2, 64]} />
        <meshBasicMaterial ref={ring2Ref} color={STATE_COLOR.idle} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Lente */}
      <mesh position={[0, 0, 0.008]}>
        <circleGeometry args={[0.27, 64]} />
        <meshBasicMaterial ref={glowRef} color={STATE_COLOR.idle} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Núcleo central */}
      <mesh ref={coreMesh} position={[0, 0, 0.02]}>
        <circleGeometry args={[0.1, 32]} />
        <meshBasicMaterial ref={coreRef} color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Estúdio Procedural ───────────────────────────────────────────────────
function StudioEnvironment() {
  return (
    <Environment resolution={128}>
      <Lightformer intensity={3}   color="#ffffff" position={[0, 4, 3]}   scale={[4, 3, 1]} />
      <Lightformer intensity={2}   color="#22d3ee" position={[-4, 1, 2]}  scale={[3, 2, 1]} rotation={[0, Math.PI / 2, 0]} />
      <Lightformer intensity={1.6} color="#0af0c0" position={[4, -1, 2]}  scale={[3, 2, 1]} rotation={[0, -Math.PI / 2, 0]} />
      <Lightformer intensity={1.2} color="#ffffff" position={[0, -4, 1]}  scale={[6, 1, 1]} />
    </Environment>
  );
}

/* ── Único acréscimo: monta MetalShell + EyeCore num grupo que "estoura pra
   dentro" com um leve overshoot elástico na entrada, junto com um giro
   extra que desacelera até parar — depois disso fica exatamente como o
   group scale={0.20} original, sem nenhuma outra diferença. ──────────────── */
function OrbAssembly(props: Props) {
  const assemblyRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!assemblyRef.current) return;
    const t = clock.elapsedTime;
    const pop = easeOutBack(t / SHELL_POP_DURATION);
    assemblyRef.current.scale.setScalar(STEADY_SCALE * Math.max(pop, 0.001));

    const spinLeft = Math.exp(-t / SHELL_SPIN_DECAY) * 3.2;
    assemblyRef.current.rotation.y = spinLeft;
  });

  return (
    <group ref={assemblyRef} scale={0.001}>
      <MetalShell {...props} />
      <EyeCore {...props} />
    </group>
  );
}

function Scene(props: Props) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[2, 2, 3]} intensity={0.4} color="#ffffff" />

      {/* Tamanho mantido compacto conforme o pedido anterior (0.20) —
         agora com animação de entrada via OrbAssembly */}
      <OrbAssembly {...props} />

      <StudioEnvironment />
    </>
  );
}

export function MetalOrb({ speaking, recognizing, error, bloomIntensity = 0.8 }: Props) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [dpr, setDpr] = useState(isMobile ? 1 : 1.5);
  const [webglOk] = useState(() => isWebGLAvailable());

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!webglOk) return <WebGLUnavailableFallback label="Esfera" />;

  return (
    <Canvas
      camera={{ position: [0, 0, 3.4], fov: 10 }}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(d => Math.min(d + 0.25, isMobile ? 1.25 : 2))}
        onDecline={() => setDpr(d => Math.max(d - 0.25, 0.75))}
      />
      <AdaptiveDpr pixelated />
      <Scene speaking={speaking} recognizing={recognizing} error={error} />
      {bloomIntensity > 0 && (
        <EffectComposer enableNormalPass={false}>
          <Bloom
            intensity={isMobile ? bloomIntensity * 0.7 : bloomIntensity}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.8}
            radius={0.5}
            mipmapBlur={!isMobile}
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}