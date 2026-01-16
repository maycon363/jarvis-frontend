import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

interface Props {
    speaking: boolean;
    environmentPreset: string;
    error: boolean;
    humor?: 'angry' | 'calm' | 'neutral';
}

function Scene({ glbPath, speaking, error, isMobile, humor }: { glbPath: string, speaking: boolean, error: boolean, isMobile: boolean, humor?: string }) {
    const { scene } = useGLTF(glbPath);
    const reactorRef = useRef<THREE.Mesh>(null);
    const modelRef = useRef<THREE.Group>(null);
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

    useEffect(() => {
        const onResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        scene.traverse((child: any) => {
            if (!child.isMesh) return;
            child.castShadow = !isMobile;
            child.receiveShadow = !isMobile;

            if (child.name === 'Lights_Lights_0') {
                reactorRef.current = child;
                if (child.material) {
                    child.material = child.material.clone();
                    child.material.emissiveIntensity = 0;
                }
            }
        });
    }, [scene, isMobile]);

    useFrame((state) => {
        if (!reactorRef.current) return;
        const mat = reactorRef.current.material as THREE.MeshStandardMaterial;
        const time = state.clock.elapsedTime;
        const pulse = (Math.sin(time * 10) + 1) / 2;

        const isActuallyAngry = (error || humor === 'angry') && humor !== 'neutral';

        if (isActuallyAngry) {
            // ESTADO: RAIVA / ERRO (Vermelho Pulsante)
            mat.emissive.set(0xff0000);
            mat.emissiveIntensity = THREE.MathUtils.lerp(5, 10, pulse);
        } else if (speaking) {
            // ESTADO: FALANDO (Verde Jarvis)
            mat.emissive.set(0x24a627); 
            mat.emissiveIntensity = THREE.MathUtils.lerp(5, 10, pulse);
        } else {
            // ESTADO: DESLIGADO (Blackout)
            // A intensidade cai para 0 de forma suave (lerp)
            mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0, 0.1);
        }
    });

    const scaleFactor = isMobile && isLandscape ? 1300 : 1340;
    const yPosition = isMobile && isLandscape ? -66 : -72;

    return (
        <Suspense fallback={null}>
            <group
                ref={modelRef}
                position={[0, yPosition, 0]}
                rotation={isMobile ? [0, 4.7, 0] : [0, 1.5, 0]}
            >
                <primitive object={scene} scale={scaleFactor} />
            </group>

            {/* LUZ DE AMBIENTE DINÂMICA: Apaga junto com o reator */}
            <pointLight
                position={[0, 26, 5]} 
                color={(error || humor === 'angry') && humor !== 'neutral' ? 0xff0000 : 0x90faff}
                // Se não estiver falando ou bravo, a luz fica em 0.05 (quase nada)
                intensity={((error || humor === 'angry') && humor !== 'neutral') || speaking ? 1.5 : 0.05}
                distance={15}
                decay={2}
            />

            {!isMobile && (
                <OrbitControls
                    enablePan={false}
                    enableRotate={false}
                    minDistance={30}
                    maxDistance={100}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 2}
                />
            )}
        </Suspense>
    );
}

export function IronManModel({ speaking, environmentPreset, error, humor }: Props) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const glbPath = new URL('/assets/ironman_mark85.glb', import.meta.url).href;

    return (
        <Canvas
            camera={{
                position: isMobile ? [-90.0, 18.15, 0.1] : [85.0, 18.15, 0.2],
                fov: 25,
            }}
            dpr={isMobile ? 1 : window.devicePixelRatio}
            gl={{
                antialias: !isMobile,
                powerPreference: 'high-performance', 
            }}
            onCreated={({ gl }) => {
                gl.outputColorSpace = THREE.SRGBColorSpace;
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 0.9;
                gl.setClearColor(0x0b0c10, 0); 
            }}
        >
            <Environment 
                files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr" 
                preset={environmentPreset as any} 
                background={false} 
            />
            
            <ContactShadows
                position={[0, -1.0, 0]}
                opacity={isMobile ? 0.2 : 0.4}
                width={15}
                height={15}
                blur={1.5}
                far={3}
            />

            <EffectComposer enableNormalPass={isMobile}>
                <Bloom
                    intensity={1.8} 
                    luminanceThreshold={0.15} 
                    luminanceSmoothing={0.9}
                    radius={0.7}
                />
            </EffectComposer>

            <Scene 
                glbPath={glbPath} 
                speaking={speaking} 
                error={error} 
                isMobile={isMobile} 
                humor={humor} 
            />
        </Canvas>
    );
}