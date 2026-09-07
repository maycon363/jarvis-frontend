import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isWebGLAvailable, WebGLUnavailableFallback } from './webglSupport';

interface Props {
  speaking:        boolean;
  recognizing:     boolean;
  error:           boolean;
  isDevOpen?:      boolean;
  bloomIntensity?: number;
}

const STATE_COLOR = {
  idle:      new THREE.Color(0x22d3ee), // ciano
  listening: new THREE.Color(0x4488ff), // azul
  speaking:  new THREE.Color(0x00ff88), // verde
  error:     new THREE.Color(0xff3322), // vermelho
  dev:       new THREE.Color(0xffffff), // branco
} as const;

const PARTICLE_COUNT_DESKTOP = 30000;
const PARTICLE_COUNT_MOBILE  = 11000;

const NECK_HEIGHT_FRACTION = 0;

const TARGET_WORLD_SIZE = 34;

let _dotTexture: THREE.Texture | null = null;
function getDotTexture(): THREE.Texture {
  if (_dotTexture) return _dotTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0,    'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  _dotTexture = new THREE.CanvasTexture(canvas);
  _dotTexture.needsUpdate = true;
  return _dotTexture;
}

interface HeadData {
  particlePositions: Float32Array; // pontos soltos (glow atmosférico)
  wireframePositions: Float32Array; // pares de pontos das arestas (estrutura)
  center: THREE.Vector3;            // centro da região da cabeça (espaço local do .glb)
  scale: number;                    // fator pra normalizar a cabeça pro tamanho-alvo de mundo
  minY: number;                     // topo/base da região (espaço local), pra animar a linha de varredura
  maxY: number;
  maxDim: number;                   // maior dimensão local, pra dimensionar a linha de varredura
}

function trimMeshAboveY(mesh: THREE.Mesh, cutoffY: number): Float32Array | null {
  const geo = mesh.geometry;
  const posAttr = geo.attributes.position;
  const index = geo.index;
  mesh.updateWorldMatrix(true, false);

  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const kept: number[] = [];

  const push = (ia: number, ib: number, ic: number) => {
    vA.fromBufferAttribute(posAttr, ia).applyMatrix4(mesh.matrixWorld);
    vB.fromBufferAttribute(posAttr, ib).applyMatrix4(mesh.matrixWorld);
    vC.fromBufferAttribute(posAttr, ic).applyMatrix4(mesh.matrixWorld);
    if (vA.y >= cutoffY && vB.y >= cutoffY && vC.y >= cutoffY) {
      kept.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
    }
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      push(i, i + 1, i + 2);
    }
  }

  return kept.length > 0 ? new Float32Array(kept) : null;
}

function extractHeadData(gltfScene: THREE.Object3D, particleCount: number): HeadData | null {
  const meshes: THREE.Mesh[] = [];
  gltfScene.traverse((child: any) => {
    if (child.isMesh && child.geometry?.attributes?.position?.count > 0) meshes.push(child);
  });
  if (meshes.length === 0) return null;

  const fullBox = new THREE.Box3().setFromObject(gltfScene);
  const cutoffY = fullBox.min.y + NECK_HEIGHT_FRACTION * (fullBox.max.y - fullBox.min.y);

  const headMeshes = meshes.filter(m => {
    const b = new THREE.Box3().setFromObject(m);
    const meshCenterY = (b.min.y + b.max.y) / 2;
    return meshCenterY >= cutoffY;
  });
  if (headMeshes.length === 0) return null;

  const trimmedTriangleSets: Float32Array[] = [];
  headMeshes.forEach(mesh => {
    const trimmed = trimMeshAboveY(mesh, cutoffY);
    if (trimmed) trimmedTriangleSets.push(trimmed);
  });
  if (trimmedTriangleSets.length === 0) return null;

  const edgesGeoms: THREE.BufferGeometry[] = trimmedTriangleSets.map(tris => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(tris, 3));
    return new THREE.EdgesGeometry(geo, 20);
  });
  const mergedEdges = mergeGeometries(edgesGeoms, false);
  if (!mergedEdges) {
    throw new Error('mergeGeometries falhou — provavelmente as malhas têm atributos de vértice incompatíveis entre si.');
  }
  const wireframePositions = (mergedEdges.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;

  const vertsPerSet = trimmedTriangleSets.map(t => t.length / 3);
  const totalVerts = vertsPerSet.reduce((a, b) => a + b, 0);
  const particlePositions = new Float32Array(particleCount * 3);
  let written = 0;
  const headBox = new THREE.Box3();
  const p = new THREE.Vector3();

  trimmedTriangleSets.forEach((tris, i) => {
    const vertCount = vertsPerSet[i];
    const share = i === trimmedTriangleSets.length - 1
      ? particleCount - written
      : Math.min(particleCount - written, Math.round((vertCount / totalVerts) * particleCount));
    for (let s = 0; s < share && written < particleCount; s++, written++) {
      const idx = Math.floor(Math.random() * vertCount);
      const x = tris[idx * 3], y = tris[idx * 3 + 1], z = tris[idx * 3 + 2];
      particlePositions[written * 3]     = x;
      particlePositions[written * 3 + 1] = y;
      particlePositions[written * 3 + 2] = z;
      p.set(x, y, z);
      headBox.expandByPoint(p);
    }
  });

  for (let i = 0; i < wireframePositions.length; i += 3) {
    headBox.expandByPoint(new THREE.Vector3(wireframePositions[i], wireframePositions[i + 1], wireframePositions[i + 2]));
  }

  const size = headBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = TARGET_WORLD_SIZE / maxDim;
  const center = headBox.getCenter(new THREE.Vector3());

  return {
    particlePositions, wireframePositions, center, scale,
    minY: headBox.min.y, maxY: headBox.max.y, maxDim,
  };
}

function StatusOverlay({ lines }: { lines: string[] }) {
  return (
    <div
      style={{
        position: 'absolute', top: 8, left: 8, zIndex: 20,
        background: 'rgba(0,0,0,0.75)', color: '#00eaff', fontFamily: 'monospace',
        fontSize: 12, padding: '8px 10px', borderRadius: 6, maxWidth: '90%',
        whiteSpace: 'pre-wrap', pointerEvents: 'none',
      }}
    >
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

function HologramScene({
  data, speaking, recognizing, error, isDevOpen,
}: {
  data:        HeadData;
  speaking:    boolean;
  recognizing: boolean;
  error:       boolean;
  isDevOpen:   boolean;
}) {
  const pointsMatRef = useRef<THREE.PointsMaterial>(null);
  const lineMatRef   = useRef<THREE.LineBasicMaterial>(null);
  const groupRef     = useRef<THREE.Group>(null);

  const { finalPositions, startPositions } = useMemo(() => {
    const final = data.particlePositions;
    const start = new Float32Array(final.length);
    const dir = new THREE.Vector3();
    const scatterRadius = data.maxDim * 0.9;
    for (let i = 0; i < final.length; i += 3) {
      dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (dir.lengthSq() < 0.0001) dir.set(1, 0, 0);
      dir.normalize().multiplyScalar(scatterRadius * (0.4 + Math.random() * 0.9));
      start[i]     = final[i]     + dir.x;
      start[i + 1] = final[i + 1] + dir.y;
      start[i + 2] = final[i + 2] + dir.z;
    }
    return { finalPositions: final, startPositions: start };
  }, [data.particlePositions, data.maxDim]);

  const pointsGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(startPositions.slice(), 3));
    const count = finalPositions.length / 3;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const b = 0.55 + Math.random() * 0.45;
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [startPositions, finalPositions]);

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.wireframePositions, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [data.wireframePositions]);

  const introStartRef = useRef<number | null>(null);
  const ASSEMBLE_DURATION = 1.6; 
  const WIREFRAME_DELAY   = 0.9; 
  const WIREFRAME_FADE_IN = 0.9;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (introStartRef.current === null) introStartRef.current = t;
    const introElapsed = t - introStartRef.current;

    const assembleRaw  = Math.min(introElapsed / ASSEMBLE_DURATION, 1);
    const assembleEase = 1 - Math.pow(1 - assembleRaw, 3); // ease-out cúbico

    const wireframeRaw  = Math.min(Math.max(introElapsed - WIREFRAME_DELAY, 0) / WIREFRAME_FADE_IN, 1);
    const wireframeEase = wireframeRaw * wireframeRaw * (3 - 2 * wireframeRaw); // smoothstep
    const targetColor = isDevOpen
      ? STATE_COLOR.dev
      : error
      ? STATE_COLOR.error
      : speaking
      ? STATE_COLOR.speaking
      : recognizing
      ? STATE_COLOR.listening
      : STATE_COLOR.idle;

    if (assembleRaw < 1) {
      const posAttr = pointsGeometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i++) {
        arr[i] = startPositions[i] + (finalPositions[i] - startPositions[i]) * assembleEase;
      }
      posAttr.needsUpdate = true;
    }

    if (pointsMatRef.current) {
      pointsMatRef.current.color.lerp(targetColor, 0.05);
      const pulse = speaking ? 1.4 : recognizing ? 1.0 : 0.6;
      const base = 0.45 + Math.sin(t * pulse) * 0.15;
      pointsMatRef.current.opacity = base * assembleEase;
    }
    if (lineMatRef.current) {
      lineMatRef.current.color.lerp(targetColor, 0.05);
      const pulse = speaking ? 2.2 : recognizing ? 1.6 : 1.0;
      const base = 0.55 + Math.sin(t * pulse) * 0.2;
      lineMatRef.current.opacity = base * wireframeEase;
    }
    if (groupRef.current) {
      if (speaking) {
        groupRef.current.rotation.y = Math.sin(t * 3.2) * THREE.MathUtils.degToRad(8);
      } else {
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.08);
      }
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.z = 0;
      groupRef.current.scale.setScalar(data.scale);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[-data.center.x * data.scale, -data.center.y * data.scale, -data.center.z * data.scale]}
      scale={data.scale}
    >
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial
          ref={lineMatRef}
          color={STATE_COLOR.idle}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <points frustumCulled={false} geometry={pointsGeometry}>
        <pointsMaterial
          ref={pointsMatRef}
          color={STATE_COLOR.idle}
          map={getDotTexture()}
          vertexColors
          size={2}
          sizeAttenuation={false}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export function IronManHologram({
  speaking,
  recognizing,
  error,
  isDevOpen      = false,
  bloomIntensity = 0.9,
}: Props) {
  const [isMobile, setIsMobile]   = useState(window.innerWidth <= 768);
  const [webglOk]                 = useState(() => isWebGLAvailable());
  const [data, setData]           = useState<HeadData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus]       = useState<string[]>(['Iniciando holograma…']);
  const [dpr, setDpr]             = useState(isMobile ? 0.8 : 1);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!webglOk) return; 
    let cancelled = false;
    const glbPath = new URL('/assets/sci-fi_helmet.glb', import.meta.url).href;
    const count = window.innerWidth <= 768 ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;

    setStatus(s => [...s, `Carregando ${glbPath.split('/').pop()}…`]);

    new GLTFLoader().load(
      glbPath,
      (gltf) => {
        if (cancelled) return;
        setStatus(s => [...s, 'Arquivo .glb carregado com sucesso.']);

        const extracted = extractHeadData(gltf.scene, count);
        if (!extracted) {
          setLoadError('Nenhuma malha encontrada acima do corte de pescoço — ajuste NECK_HEIGHT_FRACTION ou confira o eixo "para cima" do modelo.');
          return;
        }

        setStatus(s => [
          ...s,
          `${extracted.wireframePositions.length / 6} arestas de wireframe.`,
          `${count} partículas de glow.`,
          `Fator de escala aplicado: ${extracted.scale.toFixed(4)}x`,
          'Holograma pronto ✓ (painel some em instantes)',
        ]);
        setData(extracted);
      },
      (progress) => {
        if (cancelled) return;
        const pct = progress.total ? Math.round((progress.loaded / progress.total) * 100) : null;
        setStatus(s => {
          const withoutProgress = s.filter(l => !l.startsWith('Progresso:'));
          return [...withoutProgress, `Progresso: ${pct !== null ? pct + '%' : Math.round(progress.loaded / 1024) + ' KB'}`];
        });
      },
      (err) => {
        if (cancelled) return;
        const msg = err instanceof ErrorEvent ? err.message : String(err);
        setLoadError(msg);
        setStatus(s => [...s, `ERRO AO CARREGAR: ${msg}`]);
      }
    );

    return () => { cancelled = true; };
  }, []);

  const [overlayVisible, setOverlayVisible] = useState(true);
  useEffect(() => {
    if (data && !loadError) {
      const timer = setTimeout(() => setOverlayVisible(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [data, loadError]);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.setClearColor(0x0b0c10, 0);
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[IronManHologram] Contexto WebGL perdido, tentando recuperar...');
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      console.info('[IronManHologram] Contexto WebGL recuperado.');
    }, false);
  }, []);

  const showOverlay = overlayVisible || !!loadError;

  if (!webglOk) return <WebGLUnavailableFallback label="Holograma" />;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {showOverlay && (
        <StatusOverlay lines={[...status, ...(loadError ? [`❌ ${loadError}`] : [])]} />
      )}

      {loadError ? (
        <div style={{ color: '#ff3355', fontFamily: 'monospace', fontSize: 13, padding: 16 }}>
          Não foi possível carregar o holograma: {loadError}
        </div>
      ) : (
        <Canvas
          camera={{ position: [0, 0, TARGET_WORLD_SIZE * 2.1], fov: 32 }}
          dpr={dpr}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
          onCreated={handleCreated}
        >
          <PerformanceMonitor
            onIncline={() => setDpr(d => Math.min(d + 0.25, isMobile ? 1.5 : 2))}
            onDecline={() => setDpr(d => Math.max(d - 0.25, 0.75))}
          />
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />

          {data && (
            <HologramScene
              data={data}
              speaking={speaking}
              recognizing={recognizing}
              error={error}
              isDevOpen={isDevOpen}
            />
          )}

          {bloomIntensity > 0 && (
            <EffectComposer enableNormalPass={false}>
              <Bloom
                intensity={isMobile ? bloomIntensity * 0.7 : bloomIntensity}
                luminanceThreshold={0.05}
                luminanceSmoothing={0.9}
                radius={0.6}
                mipmapBlur={!isMobile}
              />
            </EffectComposer>
          )}
        </Canvas>
      )}
    </div>
  );
}