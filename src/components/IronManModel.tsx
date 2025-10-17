import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

interface Props {
    speaking: boolean;
}

export function IronManModel({ speaking }: Props) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const glbPath = new URL('/assets/ironman_mark85.glb', import.meta.url).href;
    const { scene } = useGLTF(glbPath);
    const eyeLightRef = useRef<THREE.PointLight>(null);
    const lightMeshRef = useRef<any>(null);

    useEffect(() => {
        scene.traverse((child: any) => {
            if (!child.isMesh) return;

            const metalParts = ["Red_Part", "Gold_Part", "Silver_Part"];
            const isMetalPart = metalParts.some(part => child.name.includes(part));

            if (isMetalPart) {
                child.material.metalness = 0.9;
                child.material.roughness = 0.5;
                child.material.clearcoat = 1.0;
                child.material.clearcoatRoughness = 0.02;
                child.material.envMapIntensity = 1.0;
                child.material.needsUpdate = true;
            }

            if (child.name === 'Lights_Lights_0') {
                lightMeshRef.current = child;
            }
        });
    }, [scene]);

    useEffect(() => {
        const mesh = lightMeshRef.current;
        if (!mesh) return;

        const baseColor = new THREE.Color(0x111111);
        const activeColor = new THREE.Color(0x90faff);
        const time = performance.now() * 0.005;
        const pulse = (Math.sin(time * 4) + 1) / 2;

        mesh.material.color = baseColor;
        mesh.material.toneMapped = false;
        mesh.material.roughness = 0.2;
        mesh.material.metalness = 0.4;
        mesh.material.clearcoat = 0.8;
        mesh.material.clearcoatRoughness = 0.1;
        mesh.material.transparent = false;
        mesh.material.envMapIntensity = 1.0;

        if (speaking) {
            mesh.material.emissive = activeColor;
            mesh.material.emissiveIntensity = THREE.MathUtils.lerp(2, 4, pulse);
        } else {
            mesh.material.emissive = baseColor;
            mesh.material.emissiveIntensity = 1.2;
        }

        mesh.material.needsUpdate = true;
    }, [speaking]);

    return (
        <Canvas
            camera={{
                position: isMobile ? [89.0, 18, 1.1] : [1.0, 15.15, 0.1], // ajuste fino p/ mobile
                fov: isMobile ? 35 : 35, // FOV mais aberto no mobile
            }}
            dpr={isMobile ? 1 : window.devicePixelRatio} // performance no mobile
            gl={{
                antialias: !isMobile, // desativa antialias no mobile por performance
            }}
            onCreated={({ gl }) => {
                gl.outputColorSpace = THREE.SRGBColorSpace;
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 0.9;
            }}
        >
            {/* Luzes principais */}
            <Environment preset="city" background={false} />
            <ambientLight intensity={0.05} />
            <directionalLight position={[26, 26, 26]} intensity={1.2} castShadow />
            <pointLight position={[26, 26, 26]} intensity={1.0} />

            <ContactShadows
                position={[0, -1.2, 0]}
                opacity={isMobile ? 0.2 : 0.5}
                width={10}
                height={10}
                blur={isMobile ? 0.5 : 1.5}
                far={4}
            />

            {!isMobile && (
                <EffectComposer>
                    <Bloom
                        intensity={speaking ? 0.4 : 0}
                        luminanceThreshold={0.3}
                        luminanceSmoothing={0.25}
                        radius={0.4}
                    />
                </EffectComposer>
            )}

            <pointLight
                ref={eyeLightRef}
                position={[3, 3.5, 3]}
                color={0x90faff}
                intensity={speaking ? 1 : 0}
                distance={6}
                decay={4}
            />

            <Suspense fallback={null}>
                <group
                    position={isMobile ? [0, -95.8, 0] : [0, -20.8, 0]}
                    rotation={isMobile ? [0, 1.5, 0] : [0, 1.5, 0]} // fixa a rotação aqui
                >
                    <primitive
                        object={scene}
                        scale={isMobile ? 1790 : 380}
                    />
                </group>
            </Suspense>

            {!isMobile && (
                <OrbitControls
                    enablePan={false}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 2}
                />
            )}
        </Canvas>
    );
}
