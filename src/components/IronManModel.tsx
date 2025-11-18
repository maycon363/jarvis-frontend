// src/components/IronManModel.tsx
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

interface Props {
    speaking: boolean;
}

// Componente auxiliar para a cena e otimização
function Scene({ glbPath, speaking, isMobile }: { glbPath: string, speaking: boolean, isMobile: boolean }) {
    // Carregamento do modelo
    const { scene } = useGLTF(glbPath);
    const modelRef = useRef<THREE.Group>(null);
    const lightMeshRef = useRef<any>(null);

    // 1. Otimização de Materiais (Executa Apenas Uma Vez)
    useEffect(() => {
        scene.traverse((child: any) => {
            if (!child.isMesh) return;

            // Otimização de Geometria: Garante que as geometrias sejam planas no mobile (opcional)
            if (isMobile) {
                child.castShadow = false;
                child.receiveShadow = false;
            } else {
                child.castShadow = true;
                child.receiveShadow = true;
            }

            // Aplicação de materiais PBR
            const metalParts = ["Red_Part", "Gold_Part", "Silver_Part"];
            const isMetalPart = metalParts.some(part => child.name.includes(part));

            if (isMetalPart) {
                // Mantém as propriedades PBR
                child.material.metalness = 0.9;
                child.material.roughness = 0.5;
                child.material.clearcoat = 1.0;
                child.material.clearcoatRoughness = 0.02;
                child.material.envMapIntensity = 1.0;
                child.material.needsUpdate = true;
            }

            if (child.name === 'Lights_Lights_0') {
                lightMeshRef.current = child;
                child.material.emissive = new THREE.Color(0x90faff); // Garante a cor base
            }
        });
    }, [scene, isMobile]);

    useFrame(() => {
        const mesh = lightMeshRef.current;
        if (!mesh) return;

        const activeColor = new THREE.Color(0x90faff);
        
        const time = performance.now() * 0.012;
        const pulse = (Math.sin(time * 5) + 1) / 2; 

        if (speaking) {
            mesh.material.emissive = activeColor;
            mesh.material.emissiveIntensity = THREE.MathUtils.lerp(3, 6, pulse);
        } else {
            mesh.material.emissiveIntensity = 0;
        }

        mesh.material.needsUpdate = true;
    });

    const scaleFactor = isMobile ? 1800 : 520; 
    const yPosition = isMobile ? -100.8 : -28.0;

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
                intensity={speaking ? 1 : 9}
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

export function IronManModel({ speaking }: Props) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    const cameraFOV = isMobile ? 25 : 25;

    const glbPath = new URL('/assets/ironman_mark85.glb', import.meta.url).href;

    return (
        <Canvas
            camera={{
                position: isMobile ? [-95.0, 18.15, 0.1] : [1.0, 15.15, 0.1],
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
            <Environment files="https://cdn.jsdelivr.net/gh/Poly-Haven/asset-metadata/HDRIs/kiara_1_dawn_2k.hdr" background={false}  />
            <ambientLight intensity={0.05} />

            <directionalLight position={[216, 86, 36]} intensity={0.1} castShadow />
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

            <Scene glbPath={glbPath} speaking={speaking} isMobile={isMobile} />
        </Canvas>
    );
}