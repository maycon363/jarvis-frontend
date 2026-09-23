import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
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

// Modelo: atlas-09_mecha.glb (CC0, RamonLinares/atlas-09 — ATLAS-09, o
// "xará" que dá nome ao repositório). Mesmo rig de 18 ossos do AETHER-02
// e o MESMO conjunto de animações-chave (tem Walk E Collapse, que o
// RONIN-04 não tinha), então reaproveita quase todo o mapeamento
// original. Só os nomes de material mudam:
//   - "Armor_Reactor_Emission"    (corpo/armadura — nome genérico, sem
//                                   indicar qual peça exatamente)
//   - "Cannon reactor emission"   (tem um canhão/arma montada — material
//                                   próprio, azulado)
const REACTOR_MATERIAL_NAMES = [
  'Armor_Reactor_Emission',
  'Cannon reactor emission',
];

// O .glb tem 10 clipes (rig de 18 ossos): Backflip, Collapse, HitChest,
// HitHead, KneelFire, Knockback, PunchCombo, Run, Sentinel, Walk.
//   Sentinel   (Sentinela)              — parado (idle)
//   Run        (Corrida)                — FALANDO (respondendo)
//   KneelFire  (Ajoelhar e Disparar)     — modo dev E xingamento (humor
//                                          'angry', detectado pelo backend
//                                          via detectarHumor — palavras
//                                          tipo "merda", "idiota" etc)
//   Collapse   (Desabar)                — ERRO técnico (falha de conexão/
//                                          processamento, sem relação com
//                                          o usuário xingar). Cai e FICA
//                                          CAÍDO (toca 1x, sem "levantar")
//   Walk       (Caminhada)              — recognizing (microfone pressionado)
const ANIMATION_FOR_STATE = {
  dev:       'KneelFire',
  angry:     'KneelFire', // xingamento — mesmo clipe do dev, gatilho diferente
  error:     'Collapse',  // falha técnica, separado do xingamento
  speaking:  'Run',
  listening: 'Walk',
  idle:      'Sentinel',
} as const;

// Toca uma vez, ao montar o componente, antes de qualquer lógica de estado.
const ENTRANCE_CLIP = 'Backflip';

// O ATLAS-09 NÃO tem nenhum clipe de "saudação/gesto de fala" (isso só
// existia no RONIN-04, com o BladeSalute). Deixo vazio de propósito — o
// playOnceThenSettle abaixo já ignora com segurança se o nome estiver
// vazio ou o clipe não existir, então isso é só um "desligar" limpo.
const SPEAKING_GREETING_CLIP = '';

const ANIM_FADE_SECONDS = 0.4;

// Prioridade: dev > xingamento (humor 'angry') > erro técnico > falando >
// ouvindo > parado. Xingamento e erro agora são estados SEPARADOS — antes
// caíam no mesmo balaio ("error || humor === 'angry'") e usavam a mesma
// animação; se as duas condições acontecerem ao mesmo tempo (usuário xingou
// E a requisição falhou), o xingamento vence por ser o sinal mais "social".
function computeTargetAnimation(state: {
  isDevOpen: boolean; error: boolean; humor?: string; speaking: boolean; recognizing: boolean;
}) {
  if (state.isDevOpen)          return ANIMATION_FOR_STATE.dev;
  if (state.humor === 'angry')  return ANIMATION_FOR_STATE.angry;
  if (state.error)              return ANIMATION_FOR_STATE.error;
  if (state.speaking)           return ANIMATION_FOR_STATE.speaking;
  if (state.recognizing)        return ANIMATION_FOR_STATE.listening;
  return ANIMATION_FOR_STATE.idle;
}

function Scene({ glbPath, speaking, error, isMobile, humor, isDevOpen, recognizing }: SceneProps) {
  const { scene, animations } = useGLTF(glbPath);
  const reactorMeshesRef = useRef<THREE.Mesh[]>([]);
  const modelRef   = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(animations, modelRef);
  const activeActionName = useRef<string | null>(null);
  const hasPlayedEntrance = useRef(false);
  const prevSpeaking = useRef(false);
  // Osso da cabeça + estado do offset procedural de "falando" (ver
  // useFrame mais abaixo). Guardo o offset atual e o inverso do offset do
  // frame anterior pra poder "desfazer e reaplicar" sem acumular rotação
  // ao longo do tempo, independente de o clipe ativo também animar a
  // cabeça ou não.
  const headBoneRef = useRef<THREE.Object3D | null>(null);
  const currentHeadOffset = useRef(new THREE.Quaternion());
  const prevHeadOffsetInverse = useRef(new THREE.Quaternion());
  // guarda os props mais recentes pra usar dentro de listeners de
  // 'finished' do mixer, que rodam fora do ciclo normal de render/effect
  const latestState = useRef({ isDevOpen, error, humor, speaking, recognizing });
  useEffect(() => {
    latestState.current = { isDevOpen, error, humor, speaking, recognizing };
  }, [isDevOpen, error, humor, speaking, recognizing]);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  const targetRotation    = isMobile ? 4.7 : 1.5;
  const [currentRotation] = useState(targetRotation + Math.PI);

  // Enquadramento calibrado pro ATLAS-09 (bounding box real do arquivo):
  //   altura nativa: 18.00   largura nativa: 14.94   profundidade: 6.20
  //   pés em y = 0. É bem mais LARGO que o AETHER (6.55) por causa do
  // canhão montado num dos ombros — por isso a câmera fica mais afastada
  // que a calibração "de perto" usada no AETHER, senão o canhão corta.
  const CAM = {
    default: {
      // Mais um zoom (~25% em cima do anterior), a pedido.
      pc:        [47.25, 10.7,  2.6]  as const,
      mobile:    [-49.0, 10.75, 0.07] as const,
      landscape: [-34.0, 10.65, 0.07] as const,
    },
    dev: {
      pc:        [40, 22, 14]   as const,
      mobile:    [-45, 24, 10.5] as const,
      landscape: [-34, 23, 9.5]  as const,
    },
  };

  useEffect(() => {
    const onResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', onResize);

    const reactorMeshes: THREE.Mesh[] = [];
    scene.traverse((child: any) => {
      if (!child.isMesh) return;
      child.castShadow    = !isMobile;
      child.receiveShadow = !isMobile;
      if (child.material) child.material.emissiveIntensity = 0;

      if (child.material?.name && REACTOR_MATERIAL_NAMES.includes(child.material.name)) {
        // clona o material pra não afetar outras cópias que usem o mesmo material
        child.material = child.material.clone();
        reactorMeshes.push(child);
      }

      // Reforça o reflexo do ambiente (Environment do drei) em TODO
      // material metálico do robô — sem isso, superfície metálica com
      // pouca luz direta fica com aparência "achatada"/sem textura, mesmo
      // com os mapas de normal/roughness corretos, porque metal só mostra
      // relevo via reflexo, não via cor direta.
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m: THREE.MeshStandardMaterial) => {
        if (m && 'envMapIntensity' in m) m.envMapIntensity = 1.6;
      });
    });
    reactorMeshesRef.current = reactorMeshes;

    // Busca separada pro osso da cabeça — o traverse acima só processa
    // malhas (`if (!child.isMesh) return`), e o osso 'head' não é malha.
    headBoneRef.current = scene.getObjectByName('head') || null;

    return () => window.removeEventListener('resize', onResize);
  }, [scene, isMobile]);

  // Toca um clipe UMA VEZ (sem loop) e, quando termina, faz crossfade pra
  // animação que combina com o estado atual naquele momento (via
  // computeTargetAnimation + latestState, sempre atualizado). Usado pro
  // Backflip de entrada (e, em modelos que tiverem, por um gesto de
  // saudação ao começar a falar — ver SPEAKING_GREETING_CLIP acima).
  const playOnceThenSettle = (clipName: string) => {
    const action = actions[clipName];
    if (!action) return false;

    const prevName = activeActionName.current;
    const prevAction = prevName ? actions[prevName] : null;

    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(ANIM_FADE_SECONDS).play();
    if (prevAction && prevAction !== action) prevAction.fadeOut(ANIM_FADE_SECONDS);
    activeActionName.current = clipName;

    const onFinished = (e: any) => {
      if (e.action !== action) return;
      mixer.removeEventListener('finished', onFinished);
      const nextName = computeTargetAnimation(latestState.current);
      const nextAction = actions[nextName];
      if (nextAction && nextAction !== action) {
        nextAction.reset().setEffectiveWeight(1).fadeIn(ANIM_FADE_SECONDS).play();
        action.fadeOut(ANIM_FADE_SECONDS);
        activeActionName.current = nextName;
      }
    };
    mixer.addEventListener('finished', onFinished);
    return true;
  };

  // Animação de entrada (Backflip, uma vez só) e troca normal por estado
  // — mesma ordem de prioridade usada pra cor do reator: dev > erro/raiva
  // > falando > ouvindo > parado.
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;

    // 1) Entrada única, só na primeira vez que os clipes ficam disponíveis.
    if (!hasPlayedEntrance.current) {
      hasPlayedEntrance.current = true;
      if (playOnceThenSettle(ENTRANCE_CLIP)) return; // não avalia o resto nesse ciclo
      // se o clipe de entrada não existir, cai direto pra lógica normal
    }

    // 2) Saudação ao COMEÇAR a falar — inerte no ATLAS-09 (sem clipe
    // correspondente), mantido só por consistência com outros modelos.
    const justStartedSpeaking = speaking && !prevSpeaking.current;
    prevSpeaking.current = speaking;
    if (
      SPEAKING_GREETING_CLIP &&
      justStartedSpeaking &&
      !isDevOpen &&
      !(error || humor === 'angry') &&
      activeActionName.current !== ENTRANCE_CLIP
    ) {
      if (playOnceThenSettle(SPEAKING_GREETING_CLIP)) return;
    }

    // 3) Troca normal por estado (ignorada enquanto o Backflip de entrada
    // ainda está tocando — o listener 'finished' acima cuida da transição).
    if (activeActionName.current === ENTRANCE_CLIP) return;

    const targetName = computeTargetAnimation({ isDevOpen, error, humor, speaking, recognizing });
    if (targetName === activeActionName.current) return;

    const nextAction = actions[targetName];
    if (!nextAction) {
      console.warn('[IronManModel] clipe não encontrado em actions:', targetName, '— disponíveis:', Object.keys(actions));
      return; // clipe ausente nesse asset — não quebra, só não anima
    }

    const prevName = activeActionName.current;
    const prevAction = prevName ? actions[prevName] : null;

    nextAction.reset().setEffectiveWeight(1).fadeIn(ANIM_FADE_SECONDS).play();
    if (prevAction && prevAction !== nextAction) {
      prevAction.fadeOut(ANIM_FADE_SECONDS);
    }

    activeActionName.current = targetName;
  }, [actions, mixer, isDevOpen, error, humor, speaking, recognizing]);

  useFrame(({ camera, clock }) => {
    const t     = clock.elapsedTime;

    const isPortrait     = isMobile && !isLandscape;
    const isLandscapeMob = isMobile && isLandscape;

    let targetCam: readonly [number, number, number];

    if (isDevOpen) {
      targetCam = isLandscapeMob ? CAM.dev.landscape
                : isMobile       ? CAM.dev.mobile
                :                  CAM.dev.pc;
    } else {
      // "recognizing" usa o mesmo enquadramento do estado padrão, sem
      // zoom dedicado.
      targetCam = isLandscapeMob ? CAM.default.landscape
                : isMobile       ? CAM.default.mobile
                :                  CAM.default.pc;
    }

    _camTarget.set(...targetCam);
    camera.position.lerp(_camTarget, 0.03);
    // Altura efetiva ≈17.5 (scale=0.97 × altura nativa 18.0), pés em y=0
    // → centro vertical ≈ 8.75. Mais perto da cabeça (≈15-16) no dev.
    camera.lookAt(0, isDevOpen ? 15 : 8.75, 0);

    if (modelRef.current) {
      const speakOffset  = speaking    && !isDevOpen && !isPortrait ? 0.7  : 0;
      const listenOffset = recognizing && !isDevOpen && !isPortrait ? 0.17 : 0;
      modelRef.current.rotation.y = THREE.MathUtils.lerp(
        modelRef.current.rotation.y,
        targetRotation + speakOffset + listenOffset,
        0.05
      );
    }

    // Movimento procedural sutil da cabeça — só ativo enquanto `speaking`
    // for true. Aplicado POR CIMA de qualquer clipe tocando no momento
    // (Sentinel, etc.), sem precisar de um clipe novo no .glb. Técnica:
    // "desfaz o offset do frame anterior, calcula e aplica um novo" —
    // isso garante que a rotação extra some com o que o AnimationMixer já
    // setou naquele frame (não acumula infinitamente e não some se o
    // clipe ativo também animar a cabeça).
    if (headBoneRef.current) {
      const targetOffset = speaking
        ? new THREE.Quaternion().setFromEuler(new THREE.Euler(
            Math.sin(t * 2.1) * 0.035 + Math.sin(t * 3.7) * 0.015, // "aceno" vertical sutil
            Math.sin(t * 1.4) * 0.05  + Math.sin(t * 2.9) * 0.02,  // giro leve pros lados
            0
          ))
        : new THREE.Quaternion(); // identidade = volta suave pro neutro quando não falando

      currentHeadOffset.current.slerp(targetOffset, 0.08);

      headBoneRef.current.quaternion.multiply(prevHeadOffsetInverse.current); // desfaz o offset anterior
      headBoneRef.current.quaternion.multiply(currentHeadOffset.current);      // aplica o novo
      prevHeadOffsetInverse.current = currentHeadOffset.current.clone().invert();
    }

    if (reactorMeshesRef.current.length) {
      let emissive = REACTOR_COLORS.listening;
      let low = 0.1, high = 0.6, freq = 2;

      if (isDevOpen) {
        emissive = REACTOR_COLORS.dev;   low = 8;  high = 16; freq = 8;
      } else if (error || humor === 'angry') {
        emissive = REACTOR_COLORS.error; low = 6;  high = 14; freq = 20;
      } else if (speaking) {
        emissive = REACTOR_COLORS.speaking; low = 5; high = 12; freq = 14;
      } else if (recognizing) {
        emissive = REACTOR_COLORS.listening; low = 7; high = 15; freq = 4;
      }

      const pulse = (Math.sin(t * freq) + 1) / 2;
      const intensity = isDevOpen || error || humor === 'angry' || speaking || recognizing
        ? THREE.MathUtils.lerp(low, high, pulse)
        : THREE.MathUtils.lerp(0.1, 0.6, pulse);

      for (const mesh of reactorMeshesRef.current) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!(isDevOpen || error || humor === 'angry' || speaking || recognizing)) {
          mat.emissive.set(0x001133);
        } else {
          mat.emissive.copy(emissive);
        }
        mat.emissiveIntensity = intensity;
      }
    }
  });

  // scale=0.97 dá altura efetiva ≈17.5 (18.00 nativo × 0.97), mantendo a
  // mesma altura visual que os outros modelos calibrados antes. Pés já em
  // y=0, então groupY=0 (sem precisar levantar/empurrar pra baixo).
  const groupY = 0;

  return (
    <Suspense fallback={null}>
      <group ref={modelRef} position={[0, groupY, 0]} rotation={[0, currentRotation, 0]}>
        <primitive object={scene} scale={isMobile && isLandscape ? 0.93 : 0.97} />
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

      {/* Luz de contorno permanente — não depende de speaking/error/etc.
          Sem isso, no estado parado (o mais comum) o robô fica sem
          contraste suficiente pra mostrar linhas de painel e reflexo
          metálico do normal/ORM map, dando a sensação de "sem textura". */}
      <directionalLight
        position={[6, 14, 10]}
        intensity={3.2}
        color="#eaf2ff"
      />
      <directionalLight
        position={[-8, 10, -6]}
        intensity={1.6}
        color="#5fa8ff"
      />

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

  // Arquivo servido a partir de /public/assets/ — coloque o .glb em
  // public/assets/atlas-09_mecha.glb. Precisa ser uma string simples
  // (não `new URL(..., import.meta.url)`, que é pra assets de dentro de
  // src/ e quebra com pastas em public/, gerando o erro "@fs/assets/..."
  // 404 no dev server).
  // import.meta.env.BASE_URL já inclui a barra final e respeita o
  // "base" configurado no vite.config (ex: '/jarvis-frontend/').
  const glbPath = `${import.meta.env.BASE_URL}/assets/atlas-09_mecha.glb`;

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
      camera={{ position: isMobile ? [-49.0, 10.75, 0.07] : [47.25, 10.7, 2.6], fov: 25 }}
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