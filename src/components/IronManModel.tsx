import { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ContactShadows } from '@react-three/drei';

interface Props {
    speaking: boolean;
}

export function IronManModel({ speaking }: Props) {

    const glbPath = new URL('/assets/ironman_mark85.glb', import.meta.url).href;
    const { scene } = useGLTF(glbPath);
    const eyeLightRef = useRef<THREE.PointLight>(null);

    useEffect(() => {
        const time = performance.now() * 0.005;
        const pulse = (Math.sin(time * 4) + 1) / 2; // pulso oscilando entre 0 e 1

        scene.traverse((child: any) => {
            if (!child.isMesh) return;

            // === 🎯 Ajuste para partes metálicas ===
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

            // === 💡 Ajuste para as luzes que indicam fala ===
            const isLightMesh = child.name === 'Lights_Lights_0';

            if (isLightMesh) {
                const baseColor = new THREE.Color(0x111111);        // cor escura base
                const activeColor = new THREE.Color(0x00eaff);      // azul vibrante ao falar

                // Define aparência base comum (em ambos estados)
                child.material.color = baseColor;
                child.material.roughness = 0.2;
                child.material.metalness = 0.4;
                child.material.clearcoat = 0.8;
                child.material.clearcoatRoughness = 0.1;
                child.material.transparent = false;
                child.material.envMapIntensity = 1.0;

                // === 👄 Estado: falando ===
                if (speaking) {
                    child.material.emissive = activeColor;
                    // Brilho pulsando suavemente (valor entre 4 e 10)
                    child.material.emissiveIntensity = THREE.MathUtils.lerp(2, 4, pulse);
                }

                // === 🤐 Estado: calado ===
                else {
                    child.material.emissive = baseColor;
                    child.material.emissiveIntensity = 6.5;
                }

                child.material.needsUpdate = true;
            }
        });

        // === 🔦 Luz auxiliar (ex: olhos) ===
        if (eyeLightRef.current) {
            eyeLightRef.current.intensity = speaking ? 10 : 0;
            eyeLightRef.current.color.set(0x00eaff); // mesma cor das luzes
        }

    }, [scene, speaking]);


    return (
        <Canvas
            // Altura maior
            camera={{ position: [1.0, 15.15, 0.1], fov: 1 }} // Z mais próximo, Y levemente alto
            onCreated={({ gl }) => {
                (gl as any).outputColorSpace = THREE.SRGBColorSpace;
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 0.9;
            }}
        >
            {/* 💡 Luzes */}
            <Environment preset="city" />
            <ambientLight intensity={0.05} />
            <directionalLight position={[26, 26, 26]} intensity={1.2} castShadow />
            <pointLight position={[26, 26, 26]} intensity={1.0} />

            <ContactShadows
                position={[0, -1.2, 0]}
                opacity={0.5}
                width={10}
                height={10}
                blur={1.5}
                far={4}
            />

            <EffectComposer>
                <Bloom
                    intensity={speaking ? 0.4 : 0} // aumenta quando falando
                    luminanceThreshold={0.3}    // brilho mínimo para começar a brilhar
                    luminanceSmoothing={0.25}    // suaviza a transição do brilho
                    radius={0.4}            // quão longe o brilho se espalha
                />
            </EffectComposer>

            <pointLight
                ref={eyeLightRef}
                position={[3, 3.5, 3]} // Ajuste fino para alinhar com os olhos
                color={0x32cdf0} // Azul claro
                intensity={speaking ? 1 : 0} // Começa desligada
                distance={6}
                decay={2}
            />

            <Suspense fallback={true}>
                {/* Ajuste fino da posição do modelo */}
                <group position={[0, -0.8, 0]}>
                    <primitive
                        object={scene}
                        scale={window.innerWidth <= 768 ? 14.1 : 14.1} // Zoom maior no mobile
                        rotation={[0, 1.5, 0]} // De frente
                    />
                </group>
            </Suspense>

            {/* Sem pan/zoom, só rotação horizontal */}
            <OrbitControls
                enablePan={false}
                maxPolarAngle={Math.PI / 2}
                minPolarAngle={Math.PI / 2}
            />
        </Canvas>
    );
}
