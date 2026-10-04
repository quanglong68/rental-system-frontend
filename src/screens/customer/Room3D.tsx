import { Canvas } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls, RoundedBox } from "@react-three/drei";

function Box({ p, s, c, r = 0.04 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }) {
  return <RoundedBox args={s} radius={r} position={p} castShadow receiveShadow><meshStandardMaterial color={c} roughness={0.8} /></RoundedBox>;
}

/** Phòng mẫu dạng isometric – minh họa bố cục nội thất */
export default function Room3D({ shared }: { shared: boolean }) {
  return (
    <Canvas shadows="percentage" orthographic camera={{ position: [6, 6, 6], zoom: 62 }} dpr={[1, 2]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 8, 4]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <group position={[0, -0.6, 0]}>
        <Box p={[0, -0.05, 0]} s={[4, 0.1, 3.4]} c="#e8dccb" r={0.02} />
        <Box p={[0, 1.2, -1.75]} s={[4, 2.5, 0.1]} c="#f7f7f4" r={0.02} />
        <Box p={[-2.05, 1.2, 0]} s={[0.1, 2.5, 3.4]} c="#eef0ec" r={0.02} />
        <mesh position={[0.6, 1.45, -1.69]}><boxGeometry args={[1.4, 1, 0.02]} /><meshStandardMaterial color="#cfe8f5" emissive="#cfe8f5" emissiveIntensity={0.4} /></mesh>
        {/* giường */}
        <Box p={[-1.1, 0.25, -0.6]} s={[1.5, 0.4, 2]} c="#dfe5e0" />
        <Box p={[-1.1, 0.5, -1.4]} s={[1.3, 0.18, 0.35]} c="#ffffff" />
        <Box p={[-1.1, 0.48, -0.25]} s={[1.52, 0.08, 1.2]} c="#c8f169" />
        {shared && <><Box p={[0.9, 0.25, 0.7]} s={[1.5, 0.4, 1.2]} c="#dfe5e0" /><Box p={[0.9, 0.48, 0.85]} s={[1.52, 0.08, 0.8]} c="#ee765c" /></>}
        {/* bàn làm việc */}
        <Box p={[1.3, 0.75, -1.35]} s={[1.2, 0.06, 0.6]} c="#8a6a4a" />
        <Box p={[0.8, 0.37, -1.35]} s={[0.06, 0.72, 0.55]} c="#8a6a4a" />
        <Box p={[1.85, 0.37, -1.35]} s={[0.06, 0.72, 0.55]} c="#8a6a4a" />
        <Box p={[1.3, 0.98, -1.5]} s={[0.55, 0.38, 0.04]} c="#1a2a30" />
        {/* tủ */}
        <Box p={[-1.75, 0.9, 1.1]} s={[0.5, 1.8, 1]} c="#f1e9dc" />
        {/* cây */}
        <Box p={[1.6, 0.2, 1.2]} s={[0.35, 0.4, 0.35]} c="#c9b8a0" />
        <Float speed={2} floatIntensity={0.25} rotationIntensity={0.2}>
          <mesh position={[1.6, 0.75, 1.2]} castShadow><icosahedronGeometry args={[0.35, 0]} /><meshStandardMaterial color="#16796f" flatShading /></mesh>
        </Float>
        <Box p={[0, 0.02, 0.4]} s={[1.6, 0.03, 1.1]} c="#d7c6ae" r={0.01} />
      </group>
      <ContactShadows position={[0, -0.69, 0]} opacity={0.3} scale={8} blur={2} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.8} minPolarAngle={0.6} maxPolarAngle={1.1} />
    </Canvas>
  );
}
