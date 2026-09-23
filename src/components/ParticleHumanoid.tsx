'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import * as THREE from 'three';
import headObjUrl from '../assets/head.obj?url';
import { isWebGLAvailable, WebGLUnavailableFallback } from './webglSupport';

interface Props {
  speaking: boolean;
  recognizing: boolean;
  error: boolean;
  bloomIntensity?: number;
  modelUrl?: string;
  particleCount?: number;
}

// ─── Vertex shader ───────────────────────────────────────────────────────
// Desloca cada partícula: idle sutil, vibração ao falar (mais forte no
// rosto e na boca), leve reação ao "recognizing", e glitch lateral no erro.
const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uSpeaking;
uniform float uRecognizing;
uniform float uError;

attribute vec3 aNormal;
attribute float aSize;
attribute float aSeed;
attribute float aHeat;
attribute float aFace;

varying float vHeat;
varying float vFace;
varying float vError;
varying float vAlpha;

float hash(float value) {
  return fract(sin(value * 91.3458) * 47453.5453);
}

void main() {
  // ── Direção pseudo-aleatória por partícula — usada tanto pra "vir de
  //    fora" na montagem quanto pra "voar pra fora" na desintegração. ──
  float rx = hash(aSeed * 12.9898) - 0.5;
  float ry = hash(aSeed * 78.233 + 1.0) - 0.5;
  float rz = hash(aSeed * 37.719 + 2.0) - 0.5;
  vec3 randomDir = normalize(vec3(rx, ry, rz) + vec3(0.0001));

  // ── Animação de montagem: cada partícula nasce espalhada do LADO DE
  //    FORA (na direção aleatória acima, a uma distância variável) e
  //    converge até a posição final, com atraso escalonado por aSeed
  //    (não chegam todas juntas — é um "convergir" gradual). ──
  float assembleDuration = 1.9;   // segundos até a partícula mais lenta chegar
  float staggerSpread = 0.9;      // quanto o atraso varia entre partículas
  float startDelay = aSeed * staggerSpread;
  float assembleT = clamp((uTime - startDelay) / assembleDuration, 0.0, 1.0);
  float eased = assembleT * assembleT * (3.0 - 2.0 * assembleT); // smoothstep

  float entryDistance = 2.6 + hash(aSeed * 53.173) * 2.4; // varia de 2.6 a 5.0
  vec3 startPos = position + randomDir * entryDistance;
  vec3 transformed = mix(startPos, position, eased);

  // ── Movimento base ──
  float idle = sin(uTime * 1.4 + aSeed * 20.0) * 0.0015;
  float voice = sin(uTime * 7.0 - position.y * 15.0 + aSeed * 3.0) * uSpeaking * 0.004;
  float listening = sin(uTime * 3.0 - position.y * 10.0) * uRecognizing * 0.0025;

  // ── Vibração do rosto ao falar ──
  float faceWave = sin(position.x * 48.0 + position.y * 31.0 + uTime * 34.0 + aSeed * 18.0);
  float faceWave2 = sin(position.x * 83.0 - position.y * 44.0 - uTime * 48.0 + aSeed * 27.0);
  float faceMicro = sin(uTime * 55.0 + aSeed * 73.0);
  float faceVibration = (faceWave * 0.0028 + faceWave2 * 0.0015 + faceMicro * 0.0012) * aFace * uSpeaking;
  float facePulse = sin(uTime * 12.0 + aSeed * 20.0);

  transformed += aNormal * faceVibration * eased;
  transformed.x += faceWave2 * aFace * uSpeaking * 0.0014 * eased;
  transformed += aNormal * facePulse * aFace * uSpeaking * 0.0015 * eased;

  // ── Vibração extra da boca ──
  float mouthCenterY = -0.38;
  float mouthBand = exp(-pow((position.y - mouthCenterY) / 0.105, 2.0));
  float mouthWidth = exp(-pow(position.x / 0.48, 2.0));
  float mouthMask = mouthBand * mouthWidth;
  float mouthWave = sin(position.x * 42.0 + uTime * 26.0);
  float mouthWave2 = sin(position.x * 78.0 - uTime * 39.0 + position.y * 20.0);
  float mouthMicro = sin(uTime * 32.0 + aSeed * 35.0);
  float mouthMotion = (mouthWave * 0.0055 + mouthWave2 * 0.003 + mouthMicro * 0.002) * mouthMask * uSpeaking;

  transformed += aNormal * mouthMotion * eased;
  transformed.y += sin(position.x * 32.0 + uTime * 24.0) * mouthMask * uSpeaking * 0.0025 * eased;

  // ── Movimento geral ──
  transformed += aNormal * (idle + voice + listening) * eased;

  // ── Desintegração no erro: cada partícula voa na MESMA direção
  //    pseudo-aleatória usada na chegada (misturada com a normal da
  //    superfície) e vai sumindo — em vez do glitch de tremidinha. ──
  float burstAmount = uError * uError; // ease-in: começa devagar, acelera
  vec3 burstDir = normalize(aNormal * 1.2 + randomDir * 1.6);
  transformed += burstDir * burstAmount * 1.0;

  // ── Posição final ──
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // ── Tamanho da partícula ──
  float speakingScale = 1.0 + uSpeaking * (0.18 + aFace * 0.55);
  float stateScale = 1.0 + uSpeaking * 0.14 + uRecognizing * 0.10;
  gl_PointSize = aSize * stateScale * speakingScale * uPixelRatio * (4.2 / max(0.1, -mvPosition.z));
  gl_PointSize *= mix(0.25, 1.0, eased); // cresce enquanto se monta
  gl_PointSize *= mix(1.0, 0.15, burstAmount); // encolhe enquanto desintegra
  gl_PointSize = clamp(gl_PointSize, 1.0, 6.0);

  // ── Varyings ──
  vHeat = aHeat;
  vFace = aFace;
  vError = burstAmount;

  // Alpha base um pouco mais alto = partículas mais brilhantes em repouso,
  // sem depender do bloom pra "parecer" luminosas. Multiplicado por
  // "eased" pra esmaecer suavemente durante a chegada, e por
  // "(1 - burstAmount)" pra sumir de vez durante a desintegração.
  vAlpha = (0.78 + sin(uTime * 2.5 + aSeed * 40.0) * 0.10) * eased;
  vAlpha += uSpeaking * aFace * 0.20;
  vAlpha *= (1.0 - burstAmount);
}
`;

// ─── Fragment shader ─────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
varying float vHeat;
varying float vFace;
varying float vError;
varying float vAlpha;

void main() {
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  if (distanceToCenter > 0.5) discard;

  // Núcleo um pouco maior (0.20 em vez de 0.16) = mais área branca/quente
  // no meio de cada partícula, deixando o conjunto mais brilhante sem
  // precisar aumentar o bloom.
  float particle = smoothstep(0.5, 0.08, distanceToCenter);
  float core = smoothstep(0.20, 0.0, distanceToCenter);

  vec3 blue = vec3(0.015, 0.25, 1.0);
  vec3 cyan = vec3(0.0, 0.92, 1.0);
  vec3 red = vec3(1.0, 0.01, 0.005);
  vec3 brightRed = vec3(1.0, 0.10, 0.02);
  vec3 whiteRed = vec3(1.0, 0.42, 0.22);

  vec3 coldColor = mix(blue, cyan, core);

  vec3 faceColor = mix(red, brightRed, core);
  faceColor = mix(faceColor, whiteRed, core * 0.42);

  vec3 color = mix(coldColor, faceColor, vFace);
  color = mix(color, red, vError);

  // Brilho extra do rosto ao falar — mantido contido pra não voltar a
  // estourar o bloom.
  float speakingGlow = vFace * vAlpha * 0.28;
  color += faceColor * speakingGlow;

  gl_FragColor = vec4(color, particle * clamp(vAlpha, 0.0, 0.95));
}
`;

// ─── Helpers de geometria ────────────────────────────────────────────────

function getGeometryArea(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  if (!position) return 0;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  const triangleCount = index ? index.count / 3 : position.count / 3;
  let area = 0;

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const ia = index ? index.getX(triangle * 3) : triangle * 3;
    const ib = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
    const ic = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;

    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    area += ab.cross(ac).length() * 0.5;
  }

  return area;
}

function prepareMeshes(object: THREE.Object3D): THREE.Mesh[] {
  object.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.geometry?.getAttribute('position')) return;

    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    // ⚡ OTIMIZAÇÃO: só recalcula normais se o OBJ não trouxer nenhuma.
    // computeVertexNormals() percorre todo triângulo da malha — num
    // modelo denso (dezenas/centenas de milhares de triângulos, como o
    // sci-fi_helmet.glb de referência: ~241k tris) isso sozinho já pesa.
    // Se o head.obj já foi exportado com normais (o normal do Blender),
    // esse recálculo é trabalho jogado fora.
    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals();
    }

    meshes.push(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  });

  return meshes;
}

// ⚡ OTIMIZAÇÃO: a amostragem (clonar meshes, montar o MeshSurfaceSampler,
// sortear N partículas) é o trecho mais pesado do componente e roda de
// forma síncrona. Sem cache, ela se repete TODA VEZ que <HeadParticles>
// remonta — troca de tela, toggle de visibilidade, hot-reload, StrictMode
// no dev (que monta os efeitos 2x), etc. Guardando o resultado por
// "modelUrl+particleCount" em memória, a partir da 2ª vez que essa
// combinação aparece na sessão o "surgimento" é praticamente instantâneo.
const particleBufferCache = new Map<
  string,
  {
    positions: Float32Array;
    normals: Float32Array;
    sizes: Float32Array;
    seeds: Float32Array;
    heat: Float32Array;
    face: Float32Array;
  }
>();

// ─── Cabeça de partículas ────────────────────────────────────────────────

type HeadParticlesProps = Required<
  Pick<Props, 'speaking' | 'recognizing' | 'error' | 'modelUrl' | 'particleCount'>
>;

function HeadParticles({ speaking, recognizing, error, modelUrl, particleCount }: HeadParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const obj = useLoader(OBJLoader, modelUrl);
  // ⚡ CORREÇÃO: uTime usava clock.elapsedTime (relógio global, correndo
  // desde que o Canvas montou). Se a amostragem pesada demorar, digamos,
  // 1s, na primeira vez que essas partículas aparecem o relógio já
  // marca "1s" — e a animação de montagem (que dura ~1.9s) nasce
  // PARCIALMENTE ADIANTADA: parte das partículas já aparece quase no
  // lugar final em vez de voar até lá, perdendo a graça. Guardamos aqui
  // o instante em que a geometria ficou pronta e usamos isso como
  // referência, pra "uTime" sempre começar do 0 quando o efeito aparece
  // na tela — independente de quanto o carregamento demorou.
  const startTimeRef = useRef<number | null>(null);

  const geometry = useMemo(() => {
    const cacheKey = `${modelUrl}::${particleCount}`;
    const cached = particleBufferCache.get(cacheKey);

    let positions: Float32Array;
    let normals: Float32Array;
    let sizes: Float32Array;
    let seeds: Float32Array;
    let heat: Float32Array;
    let face: Float32Array;

    if (cached) {
      // ⚡ Já foi montado nessa sessão — pula clone/normais/sampler/loop
      // inteiro e reusa os typed arrays direto.
      ({ positions, normals, sizes, seeds, heat, face } = cached);
    } else {
      const meshes = prepareMeshes(obj);
      if (!meshes.length) {
        throw new Error(`O arquivo ${modelUrl} não contém nenhum mesh válido.`);
      }

      // ── Amostragem ponderada por área de cada mesh ──
      const areas = meshes.map((mesh) => getGeometryArea(mesh.geometry));
      const totalArea = areas.reduce((total, area) => total + area, 0);
      const samplers = meshes.map((mesh) => new MeshSurfaceSampler(mesh).build());

      const cumulativeAreas: number[] = [];
      let accumulated = 0;
      for (const area of areas) {
        accumulated += area / totalArea;
        cumulativeAreas.push(accumulated);
      }

      const rawPositions = new Float32Array(particleCount * 3);
      const rawNormals = new Float32Array(particleCount * 3);
      const point = new THREE.Vector3();
      const normal = new THREE.Vector3();

      for (let i = 0; i < particleCount; i++) {
        const selection = Math.random();
        let meshIndex = cumulativeAreas.findIndex((value) => selection <= value);
        if (meshIndex < 0) meshIndex = samplers.length - 1;

        samplers[meshIndex].sample(point, normal);
        const offset = i * 3;
        rawPositions[offset] = point.x;
        rawPositions[offset + 1] = point.y;
        rawPositions[offset + 2] = point.z;
        rawNormals[offset] = normal.x;
        rawNormals[offset + 1] = normal.y;
        rawNormals[offset + 2] = normal.z;
      }

      // ── Normalização (centraliza e escala pro tamanho esperado na cena) ──
      const box = new THREE.Box3();
      for (let i = 0; i < particleCount; i++) {
        const offset = i * 3;
        point.set(rawPositions[offset], rawPositions[offset + 1], rawPositions[offset + 2]);
        box.expandByPoint(point);
      }

      const center = box.getCenter(new THREE.Vector3());
      const modelSize = box.getSize(new THREE.Vector3());
      const normalizationScale = 2.8 / Math.max(modelSize.y, 0.0001);

      positions = new Float32Array(particleCount * 3);
      normals = new Float32Array(particleCount * 3);
      sizes = new Float32Array(particleCount);
      seeds = new Float32Array(particleCount);
      heat = new Float32Array(particleCount);
      face = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        const offset = i * 3;
        const x = (rawPositions[offset] - center.x) * normalizationScale;
        const y = (rawPositions[offset + 1] - center.y) * normalizationScale;
        const z = (rawPositions[offset + 2] - center.z) * normalizationScale;

        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        normals[offset] = rawNormals[offset];
        normals[offset + 1] = rawNormals[offset + 1];
        normals[offset + 2] = rawNormals[offset + 2];
        seeds[i] = Math.random();

        // Tamanho: maioria bem fina, uma fração ocasional um pouco maior
        // (mais partículas + menores = aparência mais densa e detalhada)
        sizes[i] = Math.random() > 0.965
          ? 1.6 + Math.random() * 1.0
          : 0.85 + Math.random() * 0.85;

        const centrality = THREE.MathUtils.clamp(1 - Math.abs(x) / 0.72, 0, 1);
        const verticalRegion = THREE.MathUtils.smoothstep(y, -0.72, 0.95);

        // ── Máscara do rosto: mais estreita e mais frontal do que antes,
        //    pra concentrar o vermelho na região central do rosto em vez
        //    de vazar pras laterais/topo da cabeça. ──
        const faceHorizontal = Math.exp(-Math.pow(x / 0.42, 2.0));       // era /0.58
        const faceVertical = Math.exp(-Math.pow((y - 0.05) / 0.55, 2.0)); // era /0.72
        const frontFace = THREE.MathUtils.smoothstep(z, 0.05, 0.42);      // era a partir de -0.05

        let faceValue = faceHorizontal * faceVertical * frontFace;
        faceValue = THREE.MathUtils.clamp(faceValue, 0, 1);

        const redProbability = 0.92;
        const randomGate = Math.random() < redProbability ? 1 : 0;
        face[i] = faceValue * randomGate;

        heat[i] = Math.random() > 0.78 ? centrality * verticalRegion : 0;
      }

      for (const mesh of meshes) {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) mesh.material.dispose();
      }

      particleBufferCache.set(cacheKey, { positions, normals, sizes, seeds, heat, face });
    }

    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    result.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
    result.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    result.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    result.setAttribute('aHeat', new THREE.BufferAttribute(heat, 1));
    result.setAttribute('aFace', new THREE.BufferAttribute(face, 1));
    result.computeBoundingSphere();

    return result;
  }, [obj, modelUrl, particleCount]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Cada vez que uma geometria NOVA fica pronta, reseta a referência de
  // início — assim, mesmo trocando de modelo/particleCount em tempo de
  // execução, a montagem sempre reanima do zero.
  useEffect(() => {
    startTimeRef.current = null;
  }, [geometry]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPixelRatio: { value: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, 2) },
    uSpeaking: { value: 0 },
    uRecognizing: { value: 0 },
    uError: { value: 0 },
  }), []);

  useFrame(({ clock }, delta) => {
    const material = materialRef.current;
    const points = pointsRef.current;
    if (!material || !points) return;

    if (startTimeRef.current === null) startTimeRef.current = clock.elapsedTime;
    material.uniforms.uTime.value = clock.elapsedTime - startTimeRef.current;
    material.uniforms.uSpeaking.value = THREE.MathUtils.damp(material.uniforms.uSpeaking.value, speaking ? 1 : 0, 9, delta);
    material.uniforms.uRecognizing.value = THREE.MathUtils.damp(material.uniforms.uRecognizing.value, recognizing ? 1 : 0, 7, delta);
    // Taxa bem mais baixa que as outras (era 10) — a desintegração precisa
    // ser um espalhar lento e gradual, não uma explosão instantânea.
    material.uniforms.uError.value = THREE.MathUtils.damp(material.uniforms.uError.value, error ? 1 : 0, 1.1, delta);

    // Gira um pouco pra direita enquanto fala — sem balançar pros dois
    // lados. O damp() já faz a transição suave até esse ângulo e de volta.
    const targetRotationY = speaking ? 0.26 : 0;
    const targetRotationX = 0;
    points.rotation.y = THREE.MathUtils.damp(points.rotation.y, targetRotationY, 3.5, delta);
    points.rotation.x = THREE.MathUtils.damp(points.rotation.x, targetRotationX, 3.5, delta);
  });

  return (
    <points ref={pointsRef} geometry={geometry} position={[0, -0.5, 0]} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        depthTest
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

// ─── Componente principal ────────────────────────────────────────────────

export function ParticleHumanoid({
  speaking,
  recognizing,
  error,
  bloomIntensity = 0.4,
  modelUrl = headObjUrl,
  particleCount,
}: Props) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [dpr, setDpr] = useState(isMobile ? 1 : 1.5);
  const [webglOk] = useState(() => (typeof window !== 'undefined' ? isWebGLAvailable() : true));

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ⚡ OTIMIZAÇÃO: baixei de 140k/65k pra 90k/35k. Isso não afeta só o
  // tempo de montagem — cada partícula roda o vertex shader TODO frame,
  // então é custo recorrente (fill-rate do additive blending também
  // escala com isso). Na densidade que esse shader usa (partículas bem
  // finas, muitas sobrepostas), a diferença visual de 140k pra 90k é
  // sutil; se quiser mais densidade de volta, suba aos poucos e cheque
  // o FPS. Continua configurável via prop `particleCount`.
  const count = particleCount ?? (isMobile ? 35000 : 90000);

  if (!webglOk) return <WebGLUnavailableFallback label="Cabeça holográfica" />;

  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 38, near: 0.1, far: 100 }}
      dpr={dpr}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr((current) => Math.min(current + 0.25, isMobile ? 1.25 : 2))}
        onDecline={() => setDpr((current) => Math.max(current - 0.25, 0.75))}
      />
      <AdaptiveDpr pixelated={false} />

      <Suspense fallback={null}>
        <HeadParticles speaking={speaking} recognizing={recognizing} error={error} modelUrl={modelUrl} particleCount={count} />
      </Suspense>

      {bloomIntensity > 0 && (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={Math.min(bloomIntensity, 1.1)}
            luminanceThreshold={0.45}
            luminanceSmoothing={0.35}
            radius={0.28}
            mipmapBlur={!isMobile}
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}

export default ParticleHumanoid;