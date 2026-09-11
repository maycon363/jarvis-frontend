import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { isWebGLAvailable, WebGLUnavailableFallback } from './webglSupport';

interface Props {
  speaking: boolean;
  recognizing: boolean;
  error: boolean;
  isDevOpen?: boolean;
  bloomIntensity?: number;
}

const STATE_COLOR = {
  idle: new THREE.Color(0x2f6fe0),       // azul metálico
  listening: new THREE.Color(0x19d3ff),  // ciano
  speaking: new THREE.Color(0xff4a2e),   // vermelho-alaranjado (Ultron)
  error: new THREE.Color(0xff3b30),      // vermelho
  dev: new THREE.Color(0xffb347),        // âmbar
} as const;

const DESKTOP_VOXELS = 950;
const MOBILE_VOXELS = 420;

interface CubeNode {
  position: THREE.Vector3;
  size: number;
  phase: number;
  depth: number;
  accent: number;
  hue: number; // 0 = frio (azul), 1 = quente (vermelho/laranja) — fixo por cubo
}

/**
 * UNIVERSO DE CUBOS
 *
 * Não é uma esfera e não é um cérebro anatômico.
 * É um "ambiente de memória" tridimensional:
 * - blocos grandes perto do núcleo;
 * - cubos pequenos e metalico (cor metalica) espalhados em profundidade;
 * - regiões mais densas que lembram clusters de memória igual entre o filme do jarvis e ultron em
 * vingadores ultron;
 * - espaços vazios para a câmera conseguir atravessar o universo.
 */
function createCubeUniverse(count: number): CubeNode[] {
  const nodes: CubeNode[] = [];

  for (let i = 0; i < count; i++) {
    const depth = Math.random();

    // Mantém um eixo de passagem no centro para a câmera mergulhar.
    const corridor = Math.random() < 0.72;

    let x: number;
    let y: number;
    let z: number;

    if (corridor) {
      // Várias "camadas" como blocos de uma memória digital.
      const layer = Math.floor(Math.random() * 12);
      const layerZ = (layer - 5.5) * 1.15;

      const spread = 3.4 + depth * 7.0;

      x = (Math.random() - 0.5) * spread * 2.2;
      y = (Math.random() - 0.5) * spread * 1.45;
      z = layerZ + (Math.random() - 0.5) * 1.3;
    } else {
      // Cubos isolados fora da estrutura principal.
      const theta = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 10;

      x = Math.cos(theta) * radius;
      y = Math.sin(theta) * radius * 0.62;
      z = (Math.random() - 0.5) * 22;
    }

    // Evita excesso de cubos exatamente no túnel central.
    if (Math.abs(x) < 1.15 && Math.abs(y) < 1.0) {
      x += (Math.random() < 0.5 ? -1 : 1) * (1.25 + Math.random() * 1.6);
      y += (Math.random() - 0.5) * 1.4;
    }

    // Pequena irregularidade para fugir da aparência de grade.
    x += Math.sin(i * 2.17) * 0.09;
    y += Math.cos(i * 1.71) * 0.07;
    z += Math.sin(i * 0.93) * 0.13;

    nodes.push({
      position: new THREE.Vector3(x, y, z),
      size: 0.14 + Math.pow(Math.random(), 1.8) * 0.62,
      phase: Math.random() * Math.PI * 2,
      depth,
      accent: Math.random(),
      hue: Math.random(),
    });
  }

  return nodes;
}

// Cor "quente" (vermelho/laranja, tipo o núcleo do Ultron) e "fria" (azul
// metálico) — cada cubo nasce fixo num dos dois lados, criando o contraste
// que aparece na cena de referência, em vez de tudo virar cinza neutro.
const COLD_METAL = new THREE.Color(0x2a5fc4);
const WARM_METAL = new THREE.Color(0xc23a18);

function CubeUniverse({
  nodes,
  speaking,
  recognizing,
  error,
  isDevOpen,
}: {
  nodes: CubeNode[];
  speaking: boolean;
  recognizing: boolean;
  error: boolean;
  isDevOpen: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const primaryRef = useRef<THREE.InstancedMesh>(null);
  const accentRef = useRef<THREE.InstancedMesh>(null);

  const baseColor = useRef(STATE_COLOR.idle.clone());

  const primaryMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.92,
        roughness: 0.22,
        transparent: true,
        opacity: 0.97,
        envMapIntensity: 3.4,
        vertexColors: true,
      }),
    [],
  );

  const accentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.97,
        roughness: 0.15,
        transparent: true,
        opacity: 0.88,
        emissive: 0x0a0604,
        emissiveIntensity: 1.1,
        envMapIntensity: 4.2,
        vertexColors: true,
      }),
    [],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    return () => {
      primaryMaterial.dispose();
      accentMaterial.dispose();
    };
  }, [primaryMaterial, accentMaterial]);

  useEffect(() => {
    if (!primaryRef.current || !accentRef.current) return;

    // Cor inicial das instâncias — agora dividida entre metal frio (azul)
    // e metal quente (vermelho/laranja), em vez de cinza neutro puro.
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const metal = new THREE.Color();

      const base = node.hue > 0.5 ? WARM_METAL : COLD_METAL;
      const value = 0.5 + node.depth * 0.35;
      metal.copy(base).multiplyScalar(value * 2.1);

      // Alguns cubos ficam quase prata puro, pra variar o brilho.
      if (node.accent > 0.9) {
        metal.setRGB(0.62, 0.66, 0.72);
      }

      primaryRef.current.setColorAt(i, metal);

      tempColor
        .copy(baseColor.current)
        .lerp(new THREE.Color(0xffffff), 0.46 + node.depth * 0.2);

      accentRef.current.setColorAt(i, tempColor);
    }

    primaryRef.current.instanceColor!.needsUpdate = true;
    accentRef.current.instanceColor!.needsUpdate = true;
  }, [nodes, tempColor]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    const target = isDevOpen
      ? STATE_COLOR.dev
      : error
        ? STATE_COLOR.error
        : speaking
          ? STATE_COLOR.speaking
          : recognizing
            ? STATE_COLOR.listening
            : STATE_COLOR.idle;

    baseColor.current.lerp(target, 0.055);

    if (groupRef.current) {
      const driftStrength = speaking ? 0.18 : recognizing ? 0.11 : 0.055;

      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        Math.sin(t * 0.11) * driftStrength,
        0.025,
      );

      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        Math.sin(t * 0.08) * driftStrength * 0.45,
        0.025,
      );

      const universePulse = speaking
        ? 1 + Math.sin(t * 5.6) * 0.012
        : recognizing
          ? 1 + Math.sin(t * 3.2) * 0.008
          : 1;

      groupRef.current.scale.setScalar(universePulse);
    }

    if (!primaryRef.current || !accentRef.current) return;

    const motion = speaking ? 0.22 : recognizing ? 0.10 : 0.035;
    const accentStrength = speaking ? 0.92 : recognizing ? 0.72 : 0.38;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      const wave =
        Math.sin(
          t * (speaking ? 3.6 : recognizing ? 2.3 : 0.75) +
            node.phase +
            node.depth * 7,
        );

      const breathe = 1 + wave * (speaking ? 0.105 : recognizing ? 0.065 : 0.028);

      dummy.position.set(
        node.position.x + Math.sin(t * 0.26 + node.phase) * motion * 0.10,
        node.position.y + Math.cos(t * 0.22 + node.phase) * motion * 0.07,
        node.position.z + Math.sin(t * 0.31 + node.phase) * motion * 0.16,
      );

      dummy.rotation.set(
        Math.sin(t * 0.13 + node.phase) * 0.10,
        Math.cos(t * 0.16 + node.phase) * 0.11,
        Math.sin(t * 0.10 + node.phase) * 0.08,
      );

      dummy.scale.setScalar(node.size * breathe);
      dummy.updateMatrix();

      primaryRef.current.setMatrixAt(i, dummy.matrix);

      // Segunda camada extremamente discreta para dar "painéis" / detalhe metálico.
      const accentScale =
        node.size * (0.48 + node.depth * 0.22) *
        (1 + wave * 0.06);

      dummy.scale.setScalar(accentScale);
      dummy.updateMatrix();

      accentRef.current.setMatrixAt(i, dummy.matrix);

      // A cor percorre o universo durante fala/processamento.
      const colorMix =
        0.18 +
        Math.max(0, wave) * accentStrength * 0.70 +
        node.depth * 0.18;

      tempColor.copy(baseColor.current).lerp(
        new THREE.Color(0xffffff),
        THREE.MathUtils.clamp(colorMix, 0.12, 0.82),
      );

      accentRef.current.setColorAt(i, tempColor);

      // Metal principal: base fria/quente fixa por cubo (node.hue),
      // levemente modulada pela onda de movimento.
      const metalBase = node.hue > 0.5 ? WARM_METAL : COLD_METAL;
      const metalLight = 0.5 + node.depth * 0.36 + Math.max(0, wave) * 0.16;

      tempColor.copy(metalBase).multiplyScalar(metalLight * 2.1);

      // Pontos selecionados recebem influência forte da cor da resposta.
      if (node.accent > 0.84) {
        tempColor.lerp(baseColor.current, 0.4 + Math.max(0, wave) * 0.35);
      }

      primaryRef.current.setColorAt(i, tempColor);
    }

    primaryRef.current.instanceMatrix.needsUpdate = true;
    accentRef.current.instanceMatrix.needsUpdate = true;
    primaryRef.current.instanceColor!.needsUpdate = true;
    accentRef.current.instanceColor!.needsUpdate = true;

    accentMaterial.emissive.copy(baseColor.current).multiplyScalar(0.07);
    accentMaterial.emissiveIntensity =
      speaking ? 2.1 : recognizing ? 1.7 : error ? 2.4 : 1.15;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={primaryRef}
        args={[undefined, undefined, nodes.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={primaryMaterial} attach="material" />
      </instancedMesh>

      <instancedMesh
        ref={accentRef}
        args={[undefined, undefined, nodes.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={accentMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}

/**
 * Câmera = sensação de "mergulhar na memória".
 *
 * Idle: visão ampla.
 * Listening: aproxima um pouco.
 * Speaking: entra no universo e passa pelos cubos.
 * Error: aproxima rapidamente e recua.
 */
function MemoryDiveCamera({
  speaking,
  recognizing,
  error,
}: {
  speaking: boolean;
  recognizing: boolean;
  error: boolean;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());

  // Progresso do "mergulho" dentro do corredor de cubos — enquanto fala,
  // isso avança de verdade (a câmera atravessa o campo), em vez de só
  // aproximar e ficar parada numa distância fixa.
  const travel = useRef(0); // 0 = fora do corredor, 1 = atravessou tudo
  const TRAVEL_RANGE_Z = 20; // de z=24 (fora) até z=4 (bem dentro dos cubos)

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;

    // Avança enquanto fala; recua suavemente quando para.
    const travelSpeed = speaking ? 0.09 : -0.05;
    travel.current = THREE.MathUtils.clamp(travel.current + travelSpeed * delta * 4, 0, 1);

    // Enquanto ainda está "dentro" do mergulho (travel > 0), oscila pra
    // frente e pra trás dentro do corredor em vez de avançar só numa
    // direção — dá a sensação de estar navegando entre os blocos, não
    // atravessando uma vez e saindo do outro lado.
    const weavePhase = Math.sin(t * (speaking ? 0.55 : 0.3)) * 0.5 + 0.5;
    const effectiveTravel = travel.current * (0.4 + weavePhase * 0.6);

    let targetZ = 24 - effectiveTravel * TRAVEL_RANGE_Z;

    if (recognizing && !speaking) targetZ = Math.min(targetZ, 18.5);
    if (error) targetZ = 15.0;

    const lateralAmp = speaking ? 3.2 : recognizing ? 1.4 : 0.35;
    const verticalAmp = speaking ? 1.7 : recognizing ? 0.6 : 0.18;

    target.current.set(
      Math.sin(t * 0.24) * lateralAmp + Math.sin(t * 0.7) * (speaking ? 0.8 : 0),
      Math.cos(t * 0.2) * verticalAmp,
      targetZ,
    );

    const travelLerp = speaking ? 0.05 : recognizing ? 0.035 : 0.02;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, target.current.x, travelLerp);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, target.current.y, travelLerp);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, target.current.z, speaking ? 0.028 : 0.05);

    // Olha um pouco à frente do movimento, como se estivesse "navegando"
    // e não só girando no lugar.
    const lookTarget = new THREE.Vector3(
      Math.sin(t * 0.19) * (speaking ? 1.4 : 0.4),
      Math.cos(t * 0.16) * (speaking ? 0.8 : 0.22),
      camera.position.z - (speaking ? 9 : 4),
    );

    camera.lookAt(lookTarget);
  });

  return null;
}

function UniverseLights({
  speaking,
  recognizing,
  error,
}: {
  speaking: boolean;
  recognizing: boolean;
  error: boolean;
}) {
  const color = error
    ? '#f51408'
    : speaking
      ? '#ff5a34'
      : recognizing
        ? '#19d3ff'
        : '#4da6ff';

  return (
    <>
      <ambientLight intensity={0.16} />

      <directionalLight
        position={[7, 9, 12]}
        intensity={0.9}
        color="#dbeafe"
      />

      {/* Várias fontes quentes/frias espalhadas ao redor (não só uma de
         cada lado oposto) — evita a "linha" nítida onde uma cor domina e
         a outra some. Decay mais suave pra elas se misturarem no meio. */}
      <pointLight position={[-9, 3, 10]}  intensity={speaking ? 85 : recognizing ? 68 : 54} distance={44} decay={1.3} color="#ff5a2e" />
      <pointLight position={[9, -2, -4]}  intensity={recognizing ? 74 : 56} distance={44} decay={1.3} color="#2f6fe0" />
      <pointLight position={[8, 6, -8]}   intensity={speaking ? 62 : 44} distance={40} decay={1.3} color="#ff3b1a" />
      <pointLight position={[-8, -5, 6]}  intensity={recognizing ? 62 : 44} distance={40} decay={1.3} color="#19d3ff" />
      <pointLight position={[0, 8, 4]}    intensity={36} distance={36} decay={1.3} color="#ff6a3c" />
      <pointLight position={[0, -8, -2]}  intensity={36} distance={36} decay={1.3} color="#2f6fe0" />

      <pointLight
        position={[-2, -7, -12]}
        intensity={speaking ? 24 : 14}
        distance={24}
        decay={2}
        color={color}
      />
    </>
  );
}

// Ambiente de estúdio: sem isso, material com metalness alto fica escuro
// (metal só reflete o ambiente — sem HDRI/lightformer pra refletir, não
// existe "brilho" possível, só a luz direta das point lights, que nunca é
// suficiente sozinha). Painéis quentes e frios, como janelas de uma cidade
// à noite refletindo nos cubos — é isso que dá o efeito "metal vivo".
function StudioEnvironment() {
  return (
    <Environment resolution={192}>
      <Lightformer intensity={9}   color="#ff6a3c" position={[-6, 3, 6]}   scale={[7, 5, 1]} rotation={[0, Math.PI / 3, 0]} />
      <Lightformer intensity={8}   color="#2f6fe0" position={[6, -2, 6]}   scale={[7, 5, 1]} rotation={[0, -Math.PI / 3, 0]} />
      <Lightformer intensity={6}   color="#19d3ff" position={[0, 6, -6]}   scale={[9, 4, 1]} />
      <Lightformer intensity={5}   color="#ff3b1a" position={[0, -6, -6]}  scale={[9, 4, 1]} />
      <Lightformer intensity={5}   color="#ff6a3c" position={[6, 4, -6]}   scale={[6, 4, 1]} rotation={[0, -Math.PI / 4, 0]} />
      <Lightformer intensity={5}   color="#2f6fe0" position={[-6, -4, -6]} scale={[6, 4, 1]} rotation={[0, Math.PI / 4, 0]} />
      <Lightformer intensity={1}   color="#ffffff" position={[0, 0, 10]}   scale={[3, 3, 1]} />
    </Environment>
  );
}

function CognitiveUniverse({
  speaking,
  recognizing,
  error,
  isDevOpen,
}: {
  speaking: boolean;
  recognizing: boolean;
  error: boolean;
  isDevOpen: boolean;
}) {
  const nodes = useMemo(
    () =>
      createCubeUniverse(
        window.innerWidth <= 768 ? MOBILE_VOXELS : DESKTOP_VOXELS,
      ),
    [],
  );

  return (
    <>
      <UniverseLights
        speaking={speaking}
        recognizing={recognizing}
        error={error}
      />

      <MemoryDiveCamera
        speaking={speaking}
        recognizing={recognizing}
        error={error}
      />

      <CubeUniverse
        nodes={nodes}
        speaking={speaking}
        recognizing={recognizing}
        error={error}
        isDevOpen={isDevOpen}
      />

      <StudioEnvironment />
    </>
  );
}

export function IronManHologram({
  speaking,
  recognizing,
  error,
  isDevOpen = false,
  bloomIntensity = 1.6,
}: Props) {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth <= 768,
  );

  const [webglOk] = useState(() => isWebGLAvailable());

  const [dpr, setDpr] = useState(
    () => (window.innerWidth <= 768 ? 0.8 : 1),
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;

      setIsMobile(mobile);

      setDpr(current =>
        Math.min(current, mobile ? 1.15 : 1.35),
      );
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleCreated = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.16;
      gl.setClearColor(0x020407, 0);

      const canvas = gl.domElement;

      canvas.addEventListener(
        'webglcontextlost',
        event => {
          event.preventDefault();
          console.warn(
            '[JARVIS Universe] Contexto WebGL perdido, tentando recuperar...',
          );
        },
        false,
      );

      canvas.addEventListener(
        'webglcontextrestored',
        () => {
          console.info(
            '[JARVIS Universe] Contexto WebGL recuperado.',
          );
        },
        false,
      );
    },
    [],
  );

  if (!webglOk) {
    return <WebGLUnavailableFallback label="Universo de memória" />;
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at center, rgba(9,17,28,0.85) 0%, rgba(2,4,7,0.7) 45%, rgba(0,0,0,0) 100%)',
        // Esmaece o conteúdo renderizado (não só a cor de fundo) perto das
        // bordas — sem isso, o retângulo do WebGL sempre fica com uma
        // borda nítida, mesmo com o fundo transparente.
        WebkitMaskImage:
          'radial-gradient(ellipse at center, black 55%, transparent 96%)',
        maskImage:
          'radial-gradient(ellipse at center, black 55%, transparent 96%)',
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 24],
          fov: 48,
          near: 0.1,
          far: 100,
        }}
        dpr={dpr}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        onCreated={handleCreated}
      >
        <PerformanceMonitor
          onIncline={() =>
            setDpr(d => Math.min(d + 0.10, isMobile ? 1.15 : 1.35))
          }
          onDecline={() =>
            setDpr(d => Math.max(d - 0.10, 0.65))
          }
        />

        <AdaptiveDpr pixelated />
        <AdaptiveEvents />

        <CognitiveUniverse
          speaking={speaking}
          recognizing={recognizing}
          error={error}
          isDevOpen={isDevOpen}
        />

        {bloomIntensity > 0 && (
          <EffectComposer enableNormalPass={false}>
            <Bloom
              intensity={
                isMobile
                  ? bloomIntensity * 0.55
                  : bloomIntensity
              }
              luminanceThreshold={0.42}
              luminanceSmoothing={0.82}
              radius={0.68}
              mipmapBlur={!isMobile}
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}