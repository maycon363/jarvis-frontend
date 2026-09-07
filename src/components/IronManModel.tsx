import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { isWebGLAvailable, WebGLUnavailableFallback } from './webglSupport';

interface Props {
  speaking:          boolean;
  environmentPreset: string;
  error:             boolean;
  humor?:            'angry' | 'calm' | 'neutral';
  isDevOpen?:        boolean;
  recognizing:       boolean;
  bloomIntensity?:   number;
  bloomThreshold?:   number;
}

interface SceneProps {
  glbPath:     string;
  speaking:    boolean;
  error:       boolean;
  isMobile:    boolean;
  humor?:      string;
  isDevOpen:   boolean;
  recognizing: boolean;
}

const REACTOR_COLORS = {
  dev:       new THREE.Color(0x00ffff),  // ciano brilhante
  error:     new THREE.Color(0xff1100),  // vermelho intenso
  speaking:  new THREE.Color(0x00ff44),  // verde neon
  listening: new THREE.Color(0x4488ff),  // azul elétrico
} as const;

const _camTarget = new THREE.Vector3();

function Scene({ glbPath, speaking, error, isMobile, humor, isDevOpen, recognizing }: SceneProps) {
  const { scene }  = useGLTF(glbPath);
  const reactorRef = useRef<THREE.Mesh>(null);
  const modelRef   = useRef<THREE.Group>(null);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  const targetRotation    = isMobile ? 4.7 : 1.5;
  const [currentRotation] = useState(targetRotation + Math.PI);

  const CAM = {
    default: {
      pc:        [85.0,  18.10,  2.9] as const,
      mobile:    [-90.0, 18.15,  0.1] as const,
      landscape: [-60.0, 18.0,   0.1] as const,
    },
    dev: {
      pc:        [35,  19, 13] as const,
      mobile:    [-40, 22, 10] as const,
      landscape: [-30, 20,  8] as const,
    },
    listen: {
      pc:        [60.0,  18.10, 2.9] as const,  // era 85 → agora 60
      mobile:    [-65.0, 18.15, 0.1] as const,  // era -90 → agora -65
      landscape: [-42.0, 18.0,  0.1] as const,  // era -60 → agora -42
    },
  };

  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', onResize);

    scene.traverse((child: any) => {
      if (!child.isMesh) return;
      child.castShadow    = !isMobile;
      child.receiveShadow = !isMobile;
      if (child.material) child.material.emissiveIntensity = 0;
      if (child.name === 'Lights_Lights_0') {
        reactorRef.current = child;
        child.material     = child.material.clone();
      }
    });

    return () => window.removeEventListener('resize', onResize);
  }, [scene, isMobile]);

  useFrame(({ camera, clock }) => {
    const t     = clock.elapsedTime;

    const isPortrait     = isMobile && !isLandscape;
    const isLandscapeMob = isMobile && isLandscape;

    let targetCam: readonly [number, number, number];

    if (isDevOpen) {
      targetCam = isLandscapeMob ? CAM.dev.landscape
                : isMobile       ? CAM.dev.mobile
                :                  CAM.dev.pc;
    } else if (recognizing) {
      targetCam = isLandscapeMob ? CAM.listen.landscape
                : isMobile       ? CAM.listen.mobile
                :                  CAM.listen.pc;
    } else {
      targetCam = isLandscapeMob ? CAM.default.landscape
                : isMobile       ? CAM.default.mobile
                :                  CAM.default.pc;
    }

    _camTarget.set(...targetCam);
    camera.position.lerp(_camTarget, 0.03);
    camera.lookAt(0, isDevOpen ? -68 : -1, 0);

    if (modelRef.current) {
      const speakOffset  = speaking    && !isDevOpen && !isPortrait ? 0.7  : 0;
      const listenOffset = recognizing && !isDevOpen && !isPortrait ? 0.17 : 0;
      modelRef.current.rotation.y = THREE.MathUtils.lerp(
        modelRef.current.rotation.y,
        targetRotation + speakOffset + listenOffset,
        0.05
      );
    }

    if (reactorRef.current) {
      const mat = reactorRef.current.material as THREE.MeshStandardMaterial;

      if (isDevOpen) {
        mat.emissive.copy(REACTOR_COLORS.dev);
        const pulse = (Math.sin(t * 8) + 1) / 2;
        mat.emissiveIntensity = THREE.MathUtils.lerp(8, 16, pulse);

      } else if (error || humor === 'angry') {
        mat.emissive.copy(REACTOR_COLORS.error);
        const pulse = (Math.sin(t * 20) + 1) / 2;
        mat.emissiveIntensity = THREE.MathUtils.lerp(6, 14, pulse);

      } else if (speaking) {
        mat.emissive.copy(REACTOR_COLORS.speaking);
        const pulse = (Math.sin(t * 14) + 1) / 2;
        mat.emissiveIntensity = THREE.MathUtils.lerp(5, 12, pulse);

      } else if (recognizing) {
        mat.emissive.copy(REACTOR_COLORS.listening);
        const pulse = (Math.sin(t * 4) + 1) / 2;
        mat.emissiveIntensity = THREE.MathUtils.lerp(7, 15, pulse);

      } else {
        const pulse = (Math.sin(t * 2) + 1) / 2;
        mat.emissive.set(0x001133);
        mat.emissiveIntensity = THREE.MathUtils.lerp(0.1, 0.6, pulse);
      }
    }
  });

  const groupY = isMobile && isLandscape ? -68 : -72;

  return (
    <Suspense fallback={null}>
      <group ref={modelRef} position={[0, groupY, 0]} rotation={[0, currentRotation, 0]}>
        <primitive object={scene} scale={isMobile && isLandscape ? 1300 : 1320} />
      </group>

      <spotLight
        position={[0, 20, 40]}
        angle={0.5}
        penumbra={1}
        intensity={recognizing ? 8 : 0}
        color="#4488ff"
      />

      <spotLight
        position={[10, 15, 45]}
        angle={0.6}
        penumbra={1}
        intensity={speaking ? 6 : 0}
        color="#00ff44"
      />

      <spotLight
        position={[-10, 15, 45]}
        angle={0.6}
        penumbra={1}
        intensity={error ? 7 : 0}
        color="#ff2200"
      />

      <pointLight position={[0,    15,  60]} intensity={1.8} color="#d0eeff" decay={1.2} />

      <pointLight position={[-50,  10,  30]} intensity={0.9} color="#aaccff" decay={1.5} />
      <pointLight position={[50,   10,  30]} intensity={0.9} color="#aaccff" decay={1.5} />

      <pointLight position={[0,   -15,  40]} intensity={0.7} color="#ffffff" decay={1.5} />

      <pointLight position={[0,    60,  10]} intensity={0.5} color="#eef5ff" decay={1.8} />

      <pointLight position={[0,    20, -60]} intensity={0.4} color="#0044aa" decay={2.0} />

      {!isMobile && <OrbitControls enablePan={false} enableRotate={false} />}
    </Suspense>
  );
}

export function IronManModel({
  speaking,
  environmentPreset,
  error,
  humor,
  recognizing,
  isDevOpen      = false,
  bloomIntensity = 0.6,
  bloomThreshold = 0.25,
}: Props) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [webglOk] = useState(() => isWebGLAvailable());

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const glbPath = useRef(new URL('/assets/ironman_mark85.glb', import.meta.url).href).current;

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.outputColorSpace    = THREE.SRGBColorSpace;
    gl.toneMapping         = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.3;
    gl.setClearColor(0x0b0c10, 0);
  }, []);

  const envConfig: Record<string, { intensity: number }> = {
    night:       { intensity: 1.2 },
    city:        { intensity: 0.9 },
    studio:      { intensity: 1.2 },
    forest:      { intensity: 0.8 },
    performance: { intensity: 0.4 },
  };
  const env = envConfig[environmentPreset] ?? { intensity: 0.7 };

  if (!webglOk) return <WebGLUnavailableFallback label="Modelo 3D" />;

  return (
    <Canvas
      camera={{ position: isMobile ? [-90.0, 18.15, 0.1] : [80.0, 18.10, 0.8], fov: 25 }}
      dpr={isMobile ? 1 : Math.min(window.devicePixelRatio, 2)}
      gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
      onCreated={handleCreated}
    >
      <ambientLight intensity={env.intensity} color="#cce8ff" />

      <Environment
        preset={environmentPreset as any}
        background={false}
        environmentIntensity={env.intensity * 0.9}
      />

      <ContactShadows
        position={[0, -1.0, 0]}
        opacity={isMobile ? 0.15 : 0.35}
        width={15}
        height={15}
        blur={2}
        far={3}
      />

      {bloomIntensity > 0 && (
        <EffectComposer enableNormalPass={false}>
          <Bloom
            intensity={bloomIntensity}
            luminanceThreshold={bloomThreshold}
            luminanceSmoothing={0.85}
            radius={0.5}
            mipmapBlur
          />
        </EffectComposer>
      )}

      <Scene
        glbPath={glbPath}
        speaking={speaking}
        error={error}
        isMobile={isMobile}
        humor={humor}
        isDevOpen={isDevOpen}
        recognizing={recognizing}
      />
    </Canvas>
  );
}