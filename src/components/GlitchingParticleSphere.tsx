import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

function ProfessionalLightning({ radius, color, intensity = 1 }: { radius: number; color: string; intensity?: number }) {
  const lineRef = useRef<THREE.LineSegments>(null!);
  const segments = 16; 
  const boltsCount = 4; 

  const [positions] = useMemo(() => [new Float32Array(boltsCount * segments * 6)], [boltsCount]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    const flash = Math.sin(t * 50) > 0.6;
    lineRef.current.visible = flash;

    if (flash) {
      const posAttr = lineRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      for (let b = 0; b < boltsCount; b++) {
        const offset = b * segments * 6;

        let start = new THREE.Vector3().setFromSphericalCoords(
          radius * (0.95 + Math.random() * 0.1),
          Math.random() * Math.PI,
          Math.random() * Math.PI * 2
        );

        let end = start.clone().multiplyScalar(1.4 + Math.random() * 0.4);
        let currentPoint = start.clone();

        for (let s = 0; s < segments; s++) {
          const i6 = offset + s * 6;
          arr[i6] = currentPoint.x;
          arr[i6 + 1] = currentPoint.y;
          arr[i6 + 2] = currentPoint.z;

          let nextPoint = new THREE.Vector3().lerpVectors(start, end, (s + 1) / segments);
          
          const jitter = 0.5 * intensity; 
          nextPoint.x += (Math.random() - 0.5) * jitter;
          nextPoint.y += (Math.random() - 0.5) * jitter;
          nextPoint.z += (Math.random() - 0.5) * jitter;

          arr[i6 + 3] = nextPoint.x;
          arr[i6 + 4] = nextPoint.y;
          arr[i6 + 5] = nextPoint.z;
          currentPoint.copy(nextPoint);
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false} 
      />
    </lineSegments>
  );
}

export function GlitchingParticleSphere({
  particleCount = 25000,
  radius = 2.2,
  color = "#ff0033",  
}) {
  const pointsRef = useRef<THREE.Points>(null!);
  const bitsRef = useRef<THREE.Points>(null!);
  const { viewport } = useThree();

  const responsiveRadius = useMemo(() => {
    return Math.min(viewport.width, viewport.height) * 0.35;
  }, [viewport]);

  // 1. Geração de dados de posição e ruído
  const [originalPositions, bitsPositions, glitches] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const bits = new Float32Array(5000 * 3);
    const gl = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i3] = responsiveRadius * Math.sin(phi) * Math.cos(theta);
      pos[i3 + 1] = responsiveRadius * Math.sin(phi) * Math.sin(theta);
      pos[i3 + 2] = responsiveRadius * Math.cos(phi);
      gl[i] = Math.random();
    }

    for (let i = 0; i < 5000; i++) {
      const i3 = i * 3;
      bits[i3] = (Math.random() - 0.5) * (responsiveRadius * 4);
      bits[i3 + 1] = (Math.random() - 0.5) * (responsiveRadius * 4);
      bits[i3 + 2] = (Math.random() - 0.5) * (responsiveRadius * 4);
    }

    return [pos, bits, gl];
  }, [particleCount, responsiveRadius]);

  const renderArray = useMemo(() => new Float32Array(originalPositions), [originalPositions]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    if (pointsRef.current) {
      const geoAttr = pointsRef.current.geometry.attributes.position;
      const currentPositions = geoAttr.array as Float32Array;
      
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        const scanLine = Math.sin(t * 1.5) * responsiveRadius;
        const distToScan = Math.abs(originalPositions[i3 + 1] - scanLine);
        const isNearScan = distToScan < 0.15;
        const wave = Math.sin(originalPositions[i3] * 0.5 + t * 2) * 0.08;
        
        const noiseTrigger = Math.sin(t * 50 + glitches[i] * 100);
        
        if (noiseTrigger > 0.98 || isNearScan) {
          const shift = isNearScan ? 1.12 : 1.35;
          currentPositions[i3] = originalPositions[i3] * shift + wave;
          currentPositions[i3 + 1] = originalPositions[i3 + 1] * shift + wave;
          currentPositions[i3 + 2] = originalPositions[i3 + 2] * shift + wave;
        } else {
          currentPositions[i3] = originalPositions[i3] + wave;
          currentPositions[i3 + 1] = originalPositions[i3 + 1] + wave;
          currentPositions[i3 + 2] = originalPositions[i3 + 2] + wave;
        }
      }
      geoAttr.needsUpdate = true;
      pointsRef.current.rotation.y += 0.0006;
    }

    if (bitsRef.current) {
      bitsRef.current.rotation.y -= 0.0015;
      bitsRef.current.position.y = Math.sin(t * 0.5) * 0.15;
    }
  });

  return (
    <group>
      <ProfessionalLightning radius={responsiveRadius} color="#ffffff" intensity={0.5} />
      <ProfessionalLightning radius={responsiveRadius} color="#00f2ff" intensity={1.2} />
      <ProfessionalLightning radius={responsiveRadius} color={color} intensity={1} />

      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={renderArray}
            itemSize={3}
            args={[renderArray, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.025}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation={true}
        />
      </points>

      <points rotation={[Math.PI / 3, 0.5, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount / 2}
            array={originalPositions.slice(0, (particleCount / 2) * 3)}
            itemSize={3}
            args={[originalPositions.slice(0, (particleCount / 2) * 3), 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#00f2ff"
          size={0.03}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      <mesh>
        <sphereGeometry args={[responsiveRadius * 0.06, 16, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
        <pointLight intensity={2} distance={radius * 2} color={color} />
      </mesh>

      <points ref={bitsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={5000}
            array={bitsPositions}
            itemSize={3}
            args={[bitsPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.012}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      <mesh>
        <sphereGeometry args={[responsiveRadius * 1.15, 32, 32]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.03} 
          side={THREE.BackSide} 
        />
      </mesh>
    </group>
  );
}