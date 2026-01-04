import { useRef, useMemo } from "react";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface ParticleBrainProps {
  size?: number;
  particleCount?: number;
  status?: "idle" | "speaking" | "error" | "success";
}

export function ParticleBrain({
  size = 2.0,
  particleCount = 40000,
  status = "idle",
}: ParticleBrainProps) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<any>(null);

  const palette = {
    idle: "#157562",
    speaking: "#278717",
    error: "#f60000",
    success: "#ffffff", 
  };

  const [positions, physicsData] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const physics = new Float32Array(particleCount * 3); // 3 valores por partícula

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      const isInner = Math.random() > 0.7;
      const r = size * (isInner ? 0.4 + Math.random() * 0.2 : 0.8 + Math.random() * 0.4);

      pos[i3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
      pos[i3 + 2] = Math.cos(phi) * r;
      
      physics[i3] = Math.random() * Math.PI; // Phase
      physics[i3 + 1] = isInner ? 2.0 : 0.5 + Math.random(); // Sensibilidade
      physics[i3 + 2] = 0.5 + Math.random() * 2.0; // Fator de explosão individual
    }
    return [pos, physics];
  }, [particleCount, size]);

  useFrame((state) => {
    if (!ref.current || !matRef.current) return;
    const t = state.clock.elapsedTime;
    const geo = ref.current.geometry.attributes.position;
    const arr = geo.array as Float32Array;

    const config = {
      idle: { gravity: 0.5, turbulence: 0.15, spin: 0.6, opacity: 0.6, pSize: 0.029 },
      speaking: { gravity: 1.8, turbulence: 1.2, spin: 4.5, opacity: 0.9, pSize: 0.035 },
      error: { gravity: -8.0, turbulence: 12.0, spin: 15.0, opacity: 1.2, pSize: 0.025 }, // Gravidade negativa maior
      success: { gravity: 5.0, turbulence: 0.4, spin: 1.2, opacity: 1.8, pSize: 0.045 },
    }[status] || { gravity: 0.5, turbulence: 0.1, spin: 0.4, opacity: 0.6, pSize: 0.029 };

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const phase = physicsData[i3];
      const sens = physicsData[i3 + 1];
      const explodeFactor = physicsData[i3 + 2];

      let x = arr[i3];
      let y = arr[i3 + 1];
      let z = arr[i3 + 2];

      const dist = Math.sqrt(x * x + y * y + z * z);
      
      let targetRadius = size;

      if (status === "success") {
        // Ajuste: Mantém o tamanho base e apenas vibra, sem encolher a esfera
        const pulse = Math.pow(Math.sin(t * 4), 10) * 0.15; 
        targetRadius = size * (1.0 - pulse);
      } else if (status === "speaking") {
        targetRadius = size * 0.7;
      }

      const force = (dist - targetRadius) * config.gravity * 0.02;
      
      // LOGICA PARA VIR DE FORA (ERRO)
      if (status === "error") {
        // Expulsa as partículas para bem longe com base no explodeFactor individual
        const escapeVelocity = 0.05 * explodeFactor;
        x += (x / dist) * escapeVelocity;
        y += (y / dist) * escapeVelocity;
        z += (z / dist) * escapeVelocity;

        // Adiciona um caos fractal para não virem coladas
        const spread = Math.sin(i * 0.1 + t * 5) * 0.03;
        x += Math.cos(phase + t) * spread;
        y += Math.sin(phase + t) * spread;
      }

      x -= (x / dist) * force * sens;
      y -= (y / dist) * force * sens;
      z -= (z / dist) * force * sens;

      // Turbulência
      const noise = Math.sin(t * config.spin * 0.2 + y) * config.turbulence;
      x += Math.cos(t * sens + z) * noise * 0.01;
      y += Math.sin(t * sens + x) * noise * 0.01;
      z += Math.cos(t * sens + y) * noise * 0.01;

      // Rotação
      const rot = (config.spin + (status === "success" ? Math.sin(t * 5) * 2 : 0)) * 0.005 * sens;
      const s = Math.sin(rot);
      const c = Math.cos(rot);
      
      arr[i3] = x * c - z * s;
      arr[i3 + 1] = y;
      arr[i3 + 2] = x * s + z * c;
    }

    geo.needsUpdate = true;
    
    matRef.current.color.lerp(new THREE.Color(palette[status]), 0.1);
    
    if (status === "error") {
      matRef.current.opacity = Math.random() > 0.5 ? 0.3 : 1.8; 
      matRef.current.size = config.pSize * (Math.random() + 0.5);
    } else {
      matRef.current.opacity = THREE.MathUtils.lerp(matRef.current.opacity, config.opacity, 0.1);
      matRef.current.size = THREE.MathUtils.lerp(matRef.current.size, config.pSize, 0.1);
    }

    ref.current.rotation.y += status === "success" ? 0.01 : 0.002;
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        ref={matRef}
        transparent
        size={0.029}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={1.0}
      />
    </Points>
  );
}