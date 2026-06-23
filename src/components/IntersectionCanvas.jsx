import { Suspense, useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ── Scene constants ────────────────────────────────────────────────────────────
const RW        = 4.2;          // total road width
const HRW       = RW / 2;
const ROAD_L    = 13;           // road length from center
const STOP      = HRW + 0.45;   // stop line distance from center
const CGAP      = 1.15;         // queued car spacing
const CAR_Y     = 0.22;
const CAR_BL    = 1.05;         // car body length
const CAR_BW    = 0.62;         // car body width
const CAR_BH    = 0.28;         // car body height
const MAX_Q     = 12;
const MAX_DEP   = 20;

const CAR_COLORS = [
  '#ef4444','#3b82f6','#f59e0b','#8b5cf6','#ec4899',
  '#10b981','#f97316','#06b6d4','#84cc16','#a855f7',
  '#14b8a6','#fb923c','#e11d48','#0ea5e9',
];

const DIR = {
  N: {
    qp: (i) => [ -0.65, CAR_Y, -(STOP + 0.55 + i * CGAP) ],
    depStart: () => [ -0.65, CAR_Y, -STOP ],
    depEnd:   () => [ -0.65, CAR_Y,  ROAD_L + 2 ],
    rot: 0,
    tlPos: [ -HRW - 0.7, 0, -HRW - 0.7 ],
    color: '#00e5ff',
    depVec: [0, 0, 1],
  },
  S: {
    qp: (i) => [  0.65, CAR_Y,  STOP + 0.55 + i * CGAP ],
    depStart: () => [  0.65, CAR_Y,  STOP ],
    depEnd:   () => [  0.65, CAR_Y, -(ROAD_L + 2) ],
    rot: Math.PI,
    tlPos: [  HRW + 0.7, 0,  HRW + 0.7 ],
    color: '#ff4081',
    depVec: [0, 0, -1],
  },
  E: {
    qp: (i) => [ STOP + 0.55 + i * CGAP, CAR_Y, -0.65 ],
    depStart: () => [  STOP, CAR_Y, -0.65 ],
    depEnd:   () => [ -(ROAD_L + 2), CAR_Y, -0.65 ],
    rot: Math.PI / 2,
    tlPos: [  HRW + 0.7, 0, -HRW - 0.7 ],
    color: '#76ff03',
    depVec: [-1, 0, 0],
  },
  W: {
    qp: (i) => [ -(STOP + 0.55 + i * CGAP), CAR_Y,  0.65 ],
    depStart: () => [ -STOP, CAR_Y,  0.65 ],
    depEnd:   () => [  ROAD_L + 2, CAR_Y,  0.65 ],
    rot: -Math.PI / 2,
    tlPos: [ -HRW - 0.7, 0,  HRW + 0.7 ],
    color: '#ffab40',
    depVec: [1, 0, 0],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function rndColor(seed) {
  return CAR_COLORS[(seed * 2654435761) % CAR_COLORS.length | 0];
}

// ── Ground ─────────────────────────────────────────────────────────────────────
function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#16a34a" roughness={1} metalness={0} />
      </mesh>
      {/* Lighter grass accent patches in 4 quadrants */}
      {[[9,9],[9,-9],[-9,9],[-9,-9]].map(([x,z], i) => (
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[x,-0.03,z]} receiveShadow>
          <planeGeometry args={[10,10]} />
          <meshStandardMaterial color="#22c55e" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ── Roads ──────────────────────────────────────────────────────────────────────
function Roads() {
  const roadMat = <meshStandardMaterial color="#374151" roughness={0.8} metalness={0.05} />;
  return (
    <group>
      {/* N-S road */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[RW, ROAD_L*2]} />
        {roadMat}
      </mesh>
      {/* E-W road */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
        <planeGeometry args={[ROAD_L*2, RW]} />
        {roadMat}
      </mesh>
      {/* Intersection box slightly brighter */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.005,0]} receiveShadow>
        <planeGeometry args={[RW,RW]} />
        <meshStandardMaterial color="#4b5563" roughness={0.8} />
      </mesh>
      {/* Curbs */}
      <Curbs />
    </group>
  );
}

function Curbs() {
  const curbMat = <meshStandardMaterial color="#9ca3af" roughness={0.9} />;
  const curbH = 0.12;
  const curbW = 0.22;
  const offsets = [HRW + curbW/2, -(HRW + curbW/2)];
  return (
    <group>
      {/* N-S curbs (along x-axis) */}
      {offsets.map((ox, i) => (
        <mesh key={`ns${i}`} position={[ox, curbH/2, 0]} castShadow receiveShadow>
          <boxGeometry args={[curbW, curbH, ROAD_L*2 - RW]} />
          {curbMat}
        </mesh>
      ))}
      {/* E-W curbs (along z-axis) */}
      {offsets.map((oz, i) => (
        <mesh key={`ew${i}`} position={[0, curbH/2, oz]} castShadow receiveShadow>
          <boxGeometry args={[ROAD_L*2 - RW, curbH, curbW]} />
          {curbMat}
        </mesh>
      ))}
    </group>
  );
}

// ── Road Markings ──────────────────────────────────────────────────────────────
function RoadMarkings() {
  const dashMat = <meshStandardMaterial color="#ffffff" roughness={1} />;
  const stopMat = <meshStandardMaterial color="#ffde59" roughness={1} />;
  const dashes = [];
  const DASH_L = 0.8, DASH_GAP = 1.0, DASH_W = 0.08;
  // Vertical dashes (centre line N-S)
  for (let z = -ROAD_L; z < ROAD_L; z += DASH_L + DASH_GAP) {
    if (Math.abs(z) < HRW) continue;
    dashes.push(
      <mesh key={`vd${z}`} position={[0, 0.02, z + DASH_L/2]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[DASH_W, DASH_L]} />
        {dashMat}
      </mesh>
    );
  }
  // Horizontal dashes (centre line E-W)
  for (let x = -ROAD_L; x < ROAD_L; x += DASH_L + DASH_GAP) {
    if (Math.abs(x) < HRW) continue;
    dashes.push(
      <mesh key={`hd${x}`} position={[x + DASH_L/2, 0.02, 0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[DASH_L, DASH_W]} />
        {dashMat}
      </mesh>
    );
  }
  // Stop lines
  const stopW = 0.18;
  const stops = [
    { pos: [ 0.6, 0.02, -STOP], rot: [-Math.PI/2,0,0], geo: [HRW*0.5, stopW] },
    { pos: [-0.6, 0.02,  STOP], rot: [-Math.PI/2,0,0], geo: [HRW*0.5, stopW] },
    { pos: [ STOP, 0.02,-0.6], rot: [-Math.PI/2,0,Math.PI/2], geo: [HRW*0.5, stopW] },
    { pos: [-STOP, 0.02, 0.6], rot: [-Math.PI/2,0,Math.PI/2], geo: [HRW*0.5, stopW] },
  ];
  return (
    <group>
      {dashes}
      {stops.map((s, i) => (
        <mesh key={`sl${i}`} position={s.pos} rotation={s.rot}>
          <planeGeometry args={s.geo} />
          {stopMat}
        </mesh>
      ))}
      {/* Zebra crosswalks */}
      <ZebraGroup />
    </group>
  );
}

function ZebraGroup() {
  const mat = <meshStandardMaterial color="#e5e7eb" roughness={0.9} opacity={0.7} transparent />;
  const stripes = [];
  const SL = STOP - 0.05;
  const stripeW = 0.3;
  const nStripes = 4;
  const totalW = RW * 0.7;
  const step = totalW / nStripes;
  for (let i = 0; i < nStripes; i++) {
    const off = -totalW/2 + i*step + step/2;
    // N side
    stripes.push(<mesh key={`zn${i}`} position={[off, 0.015, -SL - stripeW/2 - 0.05]} rotation={[-Math.PI/2,0,0]}>{/* N */}
      <planeGeometry args={[0.25, stripeW]} />{mat}
    </mesh>);
    // S side
    stripes.push(<mesh key={`zs${i}`} position={[off, 0.015,  SL + stripeW/2 + 0.05]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[0.25, stripeW]} />{mat}
    </mesh>);
    // E side
    stripes.push(<mesh key={`ze${i}`} position={[ SL + stripeW/2 + 0.05, 0.015, off]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[stripeW, 0.25]} />{mat}
    </mesh>);
    // W side
    stripes.push(<mesh key={`zw${i}`} position={[-SL - stripeW/2 - 0.05, 0.015, off]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[stripeW, 0.25]} />{mat}
    </mesh>);
  }
  return <group>{stripes}</group>;
}

// ── Trees ──────────────────────────────────────────────────────────────────────
const TREE_POS = [
  [5.5,0,5.5],[8,0,8],[10,0,5],[5,0,10],
  [-5.5,0,5.5],[-8,0,8],[-10,0,5],[-5,0,10],
  [5.5,0,-5.5],[8,0,-8],[10,0,-5],[5,0,-10],
  [-5.5,0,-5.5],[-8,0,-8],[-10,0,-5],[-5,0,-10],
];

function Tree({ position }) {
  const h = 1.4 + (Math.abs(position[0] * 7 + position[2]) % 10) * 0.12;
  return (
    <group position={position}>
      <mesh position={[0, h*0.25, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.14, h*0.5, 6]} />
        <meshStandardMaterial color="#78350f" roughness={1} />
      </mesh>
      <mesh position={[0, h*0.6, 0]} castShadow>
        <coneGeometry args={[0.55, h*0.7, 7]} />
        <meshStandardMaterial color="#166534" roughness={0.9} />
      </mesh>
      <mesh position={[0, h*0.85, 0]} castShadow>
        <coneGeometry args={[0.38, h*0.5, 6]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── Buildings at corners ───────────────────────────────────────────────────────
const BLDG_CONFIGS = [
  { pos: [11,0,11], w:4, h:5.5, d:4, color:'#f1f5f9', roof:'#cbd5e1' },
  { pos: [-11,0,11], w:3.5, h:4, d:3.5, color:'#fef3c7', roof:'#fde68a' },
  { pos: [11,0,-11], w:3, h:6, d:4, color:'#ede9fe', roof:'#c4b5fd' },
  { pos: [-11,0,-11], w:4, h:4.5, d:3.5, color:'#dbeafe', roof:'#bfdbfe' },
];

function Building({ pos, w, h, d, color, roof }) {
  return (
    <group position={pos}>
      <mesh position={[0, h/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, h + 0.15, 0]} castShadow>
        <boxGeometry args={[w+0.2, 0.3, d+0.2]} />
        <meshStandardMaterial color={roof} roughness={0.8} />
      </mesh>
      {/* Windows */}
      {[-0.8,0,0.8].map((wx,wi) =>
        [1.2,2.4,3.6].filter(wy => wy < h - 0.5).map((wy,hi) => (
          <mesh key={`w${wi}${hi}`} position={[wx, wy, d/2+0.01]} castShadow>
            <boxGeometry args={[0.4, 0.5, 0.05]} />
            <meshStandardMaterial color="#bfdbfe" emissive="#bfdbfe" emissiveIntensity={0.3} roughness={0.1} metalness={0.5} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ── Traffic Light ──────────────────────────────────────────────────────────────
function TrafficLight({ dir, state }) {
  const info = DIR[dir];
  const isGreen  = state === 'green';
  const isYellow = state === 'yellow';
  const isRed    = state === 'red';

  return (
    <group position={info.tlPos}>
      {/* Pole */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 2.6, 8]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Arm */}
      <mesh position={[0.22, 2.55, 0]} castShadow>
        <boxGeometry args={[0.45, 0.07, 0.07]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* Housing */}
      <mesh position={[0.43, 2.55, 0]} castShadow>
        <boxGeometry args={[0.22, 0.65, 0.18]} />
        <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Red light */}
      <mesh position={[0.43, 2.78, 0.1]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color={isRed ? '#ff1744' : '#3a0000'}
          emissive={isRed ? '#ff1744' : '#000000'}
          emissiveIntensity={isRed ? 3 : 0}
          roughness={0.1} />
      </mesh>
      {isRed && <pointLight position={[0.43, 2.78, 0]} color="#ff1744" intensity={0.6} distance={3} />}
      {/* Yellow light */}
      <mesh position={[0.43, 2.55, 0.1]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color={isYellow ? '#ffd600' : '#2a2000'}
          emissive={isYellow ? '#ffd600' : '#000000'}
          emissiveIntensity={isYellow ? 3 : 0}
          roughness={0.1} />
      </mesh>
      {isYellow && <pointLight position={[0.43, 2.55, 0]} color="#ffd600" intensity={0.5} distance={3} />}
      {/* Green light */}
      <mesh position={[0.43, 2.32, 0.1]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color={isGreen ? '#00e676' : '#003a15'}
          emissive={isGreen ? '#00e676' : '#000000'}
          emissiveIntensity={isGreen ? 4 : 0}
          roughness={0.1} />
      </mesh>
      {isGreen && <pointLight position={[0.43, 2.32, 0]} color="#00e676" intensity={1.2} distance={5} />}
    </group>
  );
}

// ── Queued car mesh ────────────────────────────────────────────────────────────
const CAR_ROT_Y = { N: -Math.PI/2, S: Math.PI/2, E: Math.PI, W: 0 };

function QueuedCar({ position, dir, colorHex }) {
  return (
    <group position={position} rotation={[0, CAR_ROT_Y[dir] || 0, 0]}>
      {/* Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CAR_BL, CAR_BH, CAR_BW]} />
        <meshStandardMaterial color={colorHex} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Cabin / roof */}
      <mesh position={[-0.05, CAR_BH/2 + 0.1, 0]} castShadow>
        <boxGeometry args={[CAR_BL * 0.55, 0.18, CAR_BW * 0.88]} />
        <meshStandardMaterial color={colorHex} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Windscreen */}
      <mesh position={[0.12, CAR_BH/2 + 0.1, 0]}>
        <boxGeometry args={[0.02, 0.17, CAR_BW * 0.78]} />
        <meshStandardMaterial color="#93c5fd" roughness={0.05} metalness={0.1} transparent opacity={0.85} />
      </mesh>
      {/* Headlights */}
      <mesh position={[CAR_BL/2, 0, -CAR_BW*0.3]}>
        <boxGeometry args={[0.05, 0.06, 0.08]} />
        <meshStandardMaterial color="#fffde7" emissive="#fffde7" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[CAR_BL/2, 0, CAR_BW*0.3]}>
        <boxGeometry args={[0.05, 0.06, 0.08]} />
        <meshStandardMaterial color="#fffde7" emissive="#fffde7" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

// ── Per-direction queue ────────────────────────────────────────────────────────
function QueueCars({ dir, count }) {
  const n = Math.min(count || 0, MAX_Q);
  const cars = useMemo(() =>
    Array.from({ length: n }, (_, i) => ({
      pos: DIR[dir].qp(i),
      color: CAR_COLORS[(i * 3 + dir.charCodeAt(0)) % CAR_COLORS.length],
    })),
    [dir, n]
  );
  return (
    <>
      {cars.map((c, i) => (
        <QueuedCar key={i} position={c.pos} dir={dir} colorHex={c.color} />
      ))}
    </>
  );
}

// ── Departing cars (instanced) ─────────────────────────────────────────────────
function DepartingCarsSystem({ activeDirRef, queueRef, speedRef }) {
  const meshRef = useRef();
  const carsRef = useRef([]);
  const timerRef = useRef(0);
  const idRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color3 = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const spd = speedRef.current || 1;
    const sd = delta * Math.min(spd, 10);
    const activeDir = activeDirRef.current;
    const ql = queueRef.current || {};

    // Spawn new departing car
    if (activeDir && (ql[activeDir] || 0) > 0 && carsRef.current.length < MAX_DEP) {
      timerRef.current += sd;
      if (timerRef.current >= 0.9) {
        timerRef.current = 0;
        const [sx, sy, sz] = DIR[activeDir].depStart();
        const [ex, , ez] = DIR[activeDir].depEnd();
        carsRef.current.push({
          id: idRef.current++,
          dir: activeDir,
          progress: 0,
          color: CAR_COLORS[idRef.current % CAR_COLORS.length],
          sx, sy, sz, ex, ez,
        });
      }
    } else if (!activeDir) {
      timerRef.current = 0;
    }

    // Update positions
    const speed = 0.32;
    carsRef.current.forEach(c => { c.progress = Math.min(c.progress + sd * speed, 1); });
    carsRef.current = carsRef.current.filter(c => c.progress < 1);

    // Write to instanced mesh
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < MAX_DEP; i++) {
      const c = carsRef.current[i];
      if (c) {
        const px = c.sx + (c.ex - c.sx) * c.progress;
        const pz = c.sz + (c.ez - c.sz) * c.progress;
        dummy.position.set(px, c.sy, pz);
        dummy.rotation.set(0, CAR_ROT_Y[c.dir] || 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color3.set(c.color);
        mesh.setColorAt(i, color3);
      } else {
        dummy.position.set(0, -50, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_DEP]} castShadow>
      <boxGeometry args={[CAR_BL, CAR_BH, CAR_BW]} />
      <meshStandardMaterial roughness={0.3} metalness={0.4} />
    </instancedMesh>
  );
}

// ── Animated sun ──────────────────────────────────────────────────────────────
function SunLight() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * 0.05;
    ref.current.position.set(
      12 * Math.cos(t),
      14,
      12 * Math.sin(t)
    );
  });
  return (
    <directionalLight
      ref={ref}
      color="#fff8e7"
      intensity={2.2}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-near={0.5}
      shadow-camera-far={60}
      shadow-camera-left={-20}
      shadow-camera-right={20}
      shadow-camera-top={20}
      shadow-camera-bottom={-20}
    />
  );
}

// ── Direction labels ───────────────────────────────────────────────────────────
function FloatLabel({ position, text, color }) {
  const ref = useRef();
  useFrame(({ camera }) => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group position={position} ref={ref}>
      <mesh>
        <planeGeometry args={[0.8, 0.35]} />
        <meshBasicMaterial color="#00000088" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

// ── Main scene ────────────────────────────────────────────────────────────────
function Scene({ activeDir, lightStates, queueLengths, speed }) {
  const activeDirRef = useRef(activeDir);
  const queueRef     = useRef(queueLengths);
  const speedRef     = useRef(speed);

  useEffect(() => { activeDirRef.current = activeDir; }, [activeDir]);
  useEffect(() => { queueRef.current = queueLengths; },  [queueLengths]);
  useEffect(() => { speedRef.current = speed; },         [speed]);

  return (
    <>
      {/* Lighting */}
      <ambientLight color="#dbeafe" intensity={0.6} />
      <hemisphereLight skyColor="#bfdbfe" groundColor="#166534" intensity={0.9} />
      <SunLight />

      {/* Scene objects */}
      <Ground />
      <Roads />
      <RoadMarkings />
      {TREE_POS.map((p, i) => <Tree key={i} position={p} />)}
      {BLDG_CONFIGS.map((b, i) => <Building key={i} {...b} />)}

      {/* Traffic lights */}
      {['N','S','E','W'].map(d => (
        <TrafficLight key={d} dir={d} state={lightStates?.[d] ?? 'red'} />
      ))}

      {/* Queued cars */}
      {['N','S','E','W'].map(d => (
        <QueueCars key={d} dir={d} count={queueLengths?.[d] ?? 0} />
      ))}

      {/* Departing cars */}
      <DepartingCarsSystem
        activeDirRef={activeDirRef}
        queueRef={queueRef}
        speedRef={speedRef}
      />

      {/* Camera */}
      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={8}
        maxDistance={45}
        target={[0, 0.5, 0]}
      />
    </>
  );
}

// ── HTML Stats Overlay ────────────────────────────────────────────────────────
function StatsOverlay({ queueLengths, activeDir, greenCountdown, cycleNum, lightStates }) {
  const ql = queueLengths || { N:0, S:0, E:0, W:0 };
  const DIR_COLOR = { N:'#00e5ff', S:'#ff4081', E:'#76ff03', W:'#ffab40' };
  return (
    <div style={{
      position: 'absolute', top: 10, left: 10,
      display: 'flex', flexDirection: 'column', gap: 4,
      pointerEvents: 'none',
    }}>
      {['N','S','E','W'].map(d => (
        <div key={d} style={{
          background: 'rgba(10,13,20,0.82)', borderRadius: 6,
          padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 8,
          border: `1px solid ${DIR_COLOR[d]}44`,
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{ color: DIR_COLOR[d], fontWeight:700, fontSize:12, fontFamily:'monospace', minWidth:14 }}>{d}</span>
          <span style={{ color:'#e0e0e0', fontSize:12, fontFamily:'monospace' }}>{ql[d] ?? 0} cars</span>
          {d === activeDir && (
            <span style={{ color:'#00ff88', fontSize:10, fontWeight:700 }}>
              ● {greenCountdown > 0 ? `${Math.ceil(greenCountdown)}s` : 'GREEN'}
            </span>
          )}
          {d !== activeDir && lightStates?.[d] === 'yellow' && (
            <span style={{ color:'#ffd600', fontSize:10 }}>◑ YELLOW</span>
          )}
        </div>
      ))}
      {cycleNum > 0 && (
        <div style={{ background:'rgba(10,13,20,0.7)', borderRadius:6, padding:'3px 10px', fontSize:11, color:'#555', fontFamily:'monospace' }}>
          Cycle #{cycleNum}
        </div>
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function IntersectionCanvas({ simState, activeDir, lightStates, queueLengths, greenCountdown, cycleNum, speed }) {
  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'#000' }}>
      <div style={{ height: '100%' }}>
        <Canvas
          shadows
          camera={{ position: [17, 13, 17], fov: 42, near: 0.1, far: 200 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
          style={{ background: 'linear-gradient(180deg, #0ea5e9 0%, #7dd3fc 40%, #bae6fd 100%)' }}
        >
          <Suspense fallback={null}>
            <Scene
              activeDir={activeDir}
              lightStates={lightStates}
              queueLengths={queueLengths}
              speed={speed}
            />
          </Suspense>
        </Canvas>
      </div>
      <StatsOverlay
        queueLengths={queueLengths}
        activeDir={activeDir}
        greenCountdown={greenCountdown}
        cycleNum={cycleNum}
        lightStates={lightStates}
      />
    </div>
  );
}
