import { useRef, useMemo } from "react";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface ParticleSphereProps {
  size?: number;
  particleCount?: number;
  speaking?: boolean;
  status?: "idle" | "speaking" | "error" | "success";
}

export function ParticleSphere({
  size = 2.2,
  particleCount = 6000,
  status = "idle",
}: ParticleSphereProps) {
  const ref = useRef<THREE.Points>(null);

  const palette = {
    idle: "#157562",
    speaking: "#267d10",
    error: "#8f1313",
    success: "#22118f",
  };

  


  const color = palette[status];

  const offsets = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < arr.length; i++) arr[i] = Math.random() * 10;
    return arr;
  }, [particleCount]);

  // velocidades individuais
  const orbitSpeeds = useMemo(() => {
    const arr = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      arr[i] = 0.5 + Math.random() * 1.2;
    }
    return arr;
  }, [particleCount]);

  // Distribuição Fibonacci
  const particles = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * radius * size;
      const z = Math.sin(theta) * radius * size;

      positions.set([x, y * size, z], i * 3);
    }

    return positions;
  }, [particleCount, size]);

  useFrame((state) => {
    if (!ref.current) return;

    const t = state.clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;

    // Movimento
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      const speed = orbitSpeeds[i];
      const o = offsets;

      pos[idx]     += Math.cos(t * speed + o[idx]) * 0.002;
      pos[idx + 1] += Math.sin(t * speed + o[idx + 1]) * 0.002;
      pos[idx + 2] += Math.sin(t * speed + o[idx + 2]) * 0.002;
    }

    ref.current.geometry.attributes.position.needsUpdate = true;

    // Pulso por estado
    let pulse = 1;

    switch (status) {
      case "speaking":
        pulse = 1.02 + Math.sin(t * 4) * 0.02;
        break;

      case "error":
        pulse = 1.02 + Math.sin(t * 3) * 0.05;
        break;

      case "success":
        pulse = 1.02 + Math.sin(t * 2) * 0.02;
        break;

      default: 
        pulse = 1.02 + Math.sin(t * 2) * 0.03;
    }

    if (status === "error") {
      const shock = 1 + Math.sin(t * 20) * 0.1;
      ref.current.scale.set(shock, shock, shock);
    }

    if (status === "speaking") {
      ref.current.rotation.x = Math.sin(t * 0.5) * 0.03;
    }

    ref.current.scale.set(pulse, pulse, pulse);

    if (status === "speaking") ref.current.rotation.y += 0.006;
    else if (status === "error") ref.current.rotation.y += 0.012;
    else if (status === "success") ref.current.rotation.y += 0.008;
    else ref.current.rotation.y += 0.002;
  });

  

  return (
    <>
      <Points ref={ref} positions={particles} stride={3}>
        <PointMaterial
          transparent
          color={color}
          size={0.045}
          sizeAttenuation
          depthWrite={false}
          opacity={0.95}
        />
      </Points>

      <Points positions={particles} stride={3}>
        <PointMaterial
          transparent
          color={color}
          size={0.12}
          sizeAttenuation
          depthWrite={false}
          opacity={0.12}
        />
      </Points>
    </>
  );
}
