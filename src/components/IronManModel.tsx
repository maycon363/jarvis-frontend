import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

interface Props {
    speaking: boolean;
    environmentPreset: string;
    error: boolean
}

// Componente auxiliar para a cena e otimização
function Scene({ glbPath, speaking, error, isMobile }: { glbPath: string, speaking: boolean, error: boolean, isMobile: boolean }) {
    const { scene } = useGLTF(glbPath);
    const lightMeshRef = useRef<any>(null);
    const modelRef = useRef<any>(null);
    
    // UseMemo para não recriar os objetos de cor toda hora
    const colors = useMemo(() => ({
        red: new THREE.Color(0xFF0000),
        green: new THREE.Color(0x24A627),
        black: new THREE.Color(0x000000)
    }), []);

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
                lightMeshRef.current = child;
                child.material.emissiveIntensity = 0;
            }
        });
    }, [scene, isMobile]);

    useFrame((state) => {
        const mesh = lightMeshRef.current;
        if (!mesh) return;

        const mat = mesh.material as THREE.MeshStandardMaterial;
        const time = state.clock.elapsedTime;
        const pulse = (Math.sin(time * 8) + 1) / 2;

        // LÓGICA DE ESTADOS
        if (error) {
            // ESTADO ERRO: Vermelho fixo/forte
            mat.emissive.copy(colors.red);
            mat.emissiveIntensity = isMobile ? 12 : 8;
        } 
        else if (speaking) {
            // ESTADO FALANDO: Verde pulsante
            mat.emissive.copy(colors.green);
            mat.emissiveIntensity = isMobile 
                ? THREE.MathUtils.lerp(4, 10, pulse) 
                : THREE.MathUtils.lerp(2, 6, pulse);
        } 
        else {
            // ESTADO DESLIGADO: Lerp suave para o preto
            if (mat.emissiveIntensity > 0) {
                mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0, 0.15);
                if (mat.emissiveIntensity < 0.05) {
                    mat.emissive.copy(colors.black);
                    mat.emissiveIntensity = 0;
                }
            }
        }
    });

    const scaleFactor =
    isMobile && isLandscape ? 1300 :        // Garante que o modelo é visível em 20%
    1340;                                   // desktop

    const yPosition =
    isMobile && isLandscape ? -66 :        // Ajuste vertical
    -72;

    return (
        <Suspense fallback={null}>
            <group
                ref={modelRef}
                position={[0, yPosition, 0]}
                rotation={isMobile ? [0, 4.7, 0] : [0, 1.5, 0]}
            >
                <primitive
                    object={scene}
                    scale={scaleFactor}
                />
            </group>

            <pointLight
                position={[0, 26, 0]} 
                color={0x90faff}
                intensity={error ? 0 : 0.3}
                distance={1}
                decay={2}
            />

            {!isMobile && (
                <OrbitControls
                    enablePan={false}
                    enableRotate={false}
                    autoRotate={false}
                    minDistance={30}
                    maxDistance={100}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 2}
                />
            )}
        </Suspense>
    );
}

export function IronManModel({ speaking, environmentPreset, error }: Props) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    const cameraFOV = isMobile ? 25 : 25;

    const glbPath = new URL('/assets/ironman_mark85.glb', import.meta.url).href;

    const isLiteMode = environmentPreset === 'performance';

    return (
        <Canvas
            camera={{
                position: isMobile ? [-90.0, 18.15, 0.1] : [85.0, 18.15, 0.2],
                fov: cameraFOV,
            }}
            dpr={isMobile ? 1 : window.devicePixelRatio}
            gl={{
                antialias: !isMobile,
                powerPreference: 'high-performance' as const, 
            }}
            onCreated={({ gl }) => {
                gl.outputColorSpace = THREE.SRGBColorSpace;
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 0.9;
                gl.setClearColor(0x0b0c10, 0); 
            }}
        >
            {/* Luzes principais */}
            
            {!isLiteMode && (
                <Environment 
                    // ✅ CORREÇÃO VITAL: Usando um link de CDN mais confiável para o HDR (Poly Haven)
                    files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr" 
                    preset={environmentPreset as any} 
                    background={false} 
                />
            )}
            
            {/* Se for Lite Mode, garantimos que pelo menos uma luz simples esteja acesa */}
            {isLiteMode && (
                <>
                    {/* Luz ambiente simples e leve */}
                    <ambientLight intensity={2.0} color={0xaaaaaa} /> 
                    <directionalLight position={[0, 100, 0]} intensity={1.5} color={0xdddddd} />
                </>
            )}

            <pointLight position={[256, 86, 46]} intensity={0.1} />

            <ContactShadows
                position={[0, -1.0, 0]}
                opacity={isMobile ? 0.2 : 0.5}
                width={10}
                height={10}
                blur={isMobile ? 0.5 : 1.0}
                far={3}
            />

            {!isMobile && (
                <EffectComposer>
                    <Bloom
                        intensity={speaking ? 1.0 : 0}
                        luminanceThreshold={0.3}
                        luminanceSmoothing={0.25}
                        radius={0.3}
                    />
                </EffectComposer>
            )}
            {isMobile && (
                <EffectComposer enableNormalPass={false}>
                    <Bloom intensity={1.5} radius={0.4} luminanceThreshold={0.2} />
                </EffectComposer>
            )}

            <Scene glbPath={glbPath} speaking={speaking} error={error} isMobile={isMobile} />
        </Canvas>
    );
}