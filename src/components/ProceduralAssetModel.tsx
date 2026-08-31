import { useEffect, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { AssetDefinition } from "../domain/schema";
import { isDoubleLeafDoor } from "../domain/wall-openings";
import {
  getLaboratoryMaterialTexture,
  waitForLaboratoryMaterialTextures,
} from "../lib/laboratory-material-textures";

type Vector3Tuple = [number, number, number];
type DetailLevel = "room" | "preview";

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const UNIT_SPHERE = new THREE.SphereGeometry(0.5, 18, 12);
const UNIT_TORUS = new THREE.TorusGeometry(0.5, 0.11, 8, 24);
const UNIT_CONE = new THREE.CylinderGeometry(0.3, 0.5, 1, 20);
const UNIT_BOX_EDGES = new THREE.EdgesGeometry(UNIT_BOX);
const FLASK_GEOMETRY = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.02, -0.5),
    new THREE.Vector2(0.24, -0.47),
    new THREE.Vector2(0.43, -0.32),
    new THREE.Vector2(0.5, -0.08),
    new THREE.Vector2(0.45, 0.18),
    new THREE.Vector2(0.3, 0.34),
    new THREE.Vector2(0.14, 0.41),
    new THREE.Vector2(0.14, 0.5),
  ],
  32,
);

const palette = {
  powderWhite: "#dfe7e4",
  porcelain: "#f2f5f3",
  coolPanel: "#c8d2cf",
  graphite: "#697673",
  phenolic: "#172529",
  rubber: "#20292c",
  steel: "#aab8b6",
  steelDark: "#697876",
  glass: "#d5e4e3",
  screen: "#0b4550",
  screenGlow: "#49c8b7",
  teal: "#079987",
  yellow: "#d5b63b",
  red: "#bd4e49",
};

type MaterialKind =
  | "powder"
  | "limestone"
  | "oak"
  | "porcelain"
  | "stainless"
  | "aluminum"
  | "phenolic"
  | "rubber"
  | "screen"
  | "glass"
  | "painted";

type PartProps = {
  position: Vector3Tuple;
  scale: Vector3Tuple;
  color: string;
  rotation?: Vector3Tuple;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
  selected?: boolean;
  sharp?: boolean;
  materialKind?: MaterialKind;
  edgeRadius?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  envMapIntensity?: number;
};

const materialCache = new Map<string, THREE.MeshPhysicalMaterial>();
const roundedGeometryCache = new Map<string, RoundedBoxGeometry>();

function inferMaterialKind(color: string): MaterialKind {
  if (color === palette.glass || color.toLowerCase() === "#8fc5cd") return "glass";
  if (color === palette.steel) return "stainless";
  if (color === palette.steelDark) return "aluminum";
  if (color === palette.phenolic) return "phenolic";
  if (color === palette.rubber) return "rubber";
  if (color === palette.screen) return "screen";
  if (color === palette.porcelain) return "porcelain";
  if (color === palette.powderWhite || color === palette.coolPanel) return "powder";
  return "painted";
}

function cachedRoundedGeometry(scale: Vector3Tuple, requestedRadius?: number) {
  const quantized = scale.map((value) =>
    Math.max(0.002, Math.round(value * 500) / 500),
  ) as Vector3Tuple;
  const minSide = Math.min(...quantized);
  const radius = Math.max(0.0008, Math.min(requestedRadius ?? 0.018, minSide * 0.2));
  const segments = minSide < 0.025 ? 2 : 4;
  const key = [...quantized, radius, segments].map((value) => value.toFixed(4)).join("|");
  const cached = roundedGeometryCache.get(key);
  if (cached) return cached;
  const geometry = new RoundedBoxGeometry(
    quantized[0],
    quantized[1],
    quantized[2],
    segments,
    radius,
  );
  roundedGeometryCache.set(key, geometry);
  return geometry;
}

function cachedPartMaterial({
  color,
  opacity = 1,
  metalness,
  roughness,
  emissive = "#000000",
  emissiveIntensity = 0,
  materialKind,
  clearcoat,
  clearcoatRoughness,
  envMapIntensity,
}: Pick<
  PartProps,
  | "color"
  | "opacity"
  | "metalness"
  | "roughness"
  | "emissive"
  | "emissiveIntensity"
  | "materialKind"
  | "clearcoat"
  | "clearcoatRoughness"
  | "envMapIntensity"
>) {
  const kind = materialKind ?? inferMaterialKind(color);
  const isGlass = kind === "glass";
  const isSteel = kind === "stainless" || kind === "aluminum";
  const isWorktop = color === palette.phenolic || kind === "phenolic";
  const isRubber = kind === "rubber";
  const isScreen = kind === "screen";
  const materialMap = getLaboratoryMaterialTexture(kind, {
    repeat:
      kind === "powder"
        ? [3, 3]
        : kind === "stainless"
          ? [2, 2]
          : kind === "phenolic"
            ? [1.5, 1.5]
            : undefined,
  });
  const resolvedMetalness =
    metalness ??
    (kind === "stainless" ? 0.78 : kind === "aluminum" ? 0.62 : isRubber ? 0.02 : 0.05);
  const resolvedRoughness =
    roughness ??
    (isGlass
      ? 0.06
      : kind === "stainless"
        ? 0.24
        : kind === "aluminum"
          ? 0.34
          : isWorktop
            ? 0.3
            : isRubber
              ? 0.8
              : isScreen
                ? 0.2
                : kind === "powder"
                  ? 0.46
                  : 0.5);
  const key = [
    color,
    opacity,
    resolvedMetalness,
    resolvedRoughness,
    emissive,
    emissiveIntensity,
    kind,
    clearcoat,
    clearcoatRoughness,
    envMapIntensity,
  ].join("|");
  const cached = materialCache.get(key);
  if (cached) return cached;

  const material = new THREE.MeshPhysicalMaterial({
    color: materialMap && kind === "phenolic" ? "#ffffff" : color,
    ...(materialMap
      ? {
          map: materialMap,
          bumpMap: materialMap,
          bumpScale: kind === "powder" ? 0.00018 : kind === "phenolic" ? 0.00012 : 0.00008,
        }
      : {}),
    metalness: resolvedMetalness,
    roughness: resolvedRoughness,
    anisotropy: kind === "stainless" ? 0.62 : 0,
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
    transparent: isGlass || opacity < 1,
    opacity,
    depthWrite: !isGlass && opacity >= 0.8,
    side: isGlass ? THREE.DoubleSide : THREE.FrontSide,
    transmission: isGlass ? 0.82 : 0,
    thickness: isGlass ? 0.018 : 0,
    ior: isGlass ? 1.45 : 1.5,
    attenuationColor: new THREE.Color(isGlass ? "#eef7f6" : "#ffffff"),
    attenuationDistance: isGlass ? 2.4 : Infinity,
    clearcoat: clearcoat ?? (isGlass ? 0.22 : isWorktop ? 0.28 : isSteel ? 0.12 : 0.16),
    clearcoatRoughness: clearcoatRoughness ?? (isGlass ? 0.06 : isWorktop ? 0.2 : 0.3),
    envMapIntensity: envMapIntensity ?? (isGlass ? 1.2 : isSteel ? 1.08 : isScreen ? 0.9 : 0.74),
  });
  materialCache.set(key, material);
  return material;
}

function PartMaterial({
  color,
  opacity = 1,
  metalness,
  roughness,
  emissive = "#000000",
  emissiveIntensity = 0,
  materialKind,
  clearcoat,
  clearcoatRoughness,
  envMapIntensity,
}: Pick<
  PartProps,
  | "color"
  | "opacity"
  | "metalness"
  | "roughness"
  | "emissive"
  | "emissiveIntensity"
  | "materialKind"
  | "clearcoat"
  | "clearcoatRoughness"
  | "envMapIntensity"
>) {
  return (
    <primitive
      object={cachedPartMaterial({
        color,
        opacity,
        metalness,
        roughness,
        emissive,
        emissiveIntensity,
        materialKind,
        clearcoat,
        clearcoatRoughness,
        envMapIntensity,
      })}
      attach="material"
    />
  );
}

export function ModelBox({
  position,
  scale,
  color,
  rotation = [0, 0, 0],
  opacity = 1,
  metalness,
  roughness,
  emissive,
  emissiveIntensity,
  castShadow = true,
  selected = false,
  sharp = false,
  materialKind,
  edgeRadius,
  clearcoat,
  clearcoatRoughness,
  envMapIntensity,
}: PartProps) {
  const geometry = sharp ? UNIT_BOX : cachedRoundedGeometry(scale, edgeRadius);
  return (
    <mesh
      position={position}
      scale={sharp ? scale : [1, 1, 1]}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow
    >
      <primitive object={geometry} attach="geometry" />
      <PartMaterial
        color={color}
        opacity={opacity}
        metalness={metalness}
        roughness={roughness}
        emissive={selected ? palette.teal : emissive}
        emissiveIntensity={selected ? 0.22 : emissiveIntensity}
        materialKind={materialKind}
        clearcoat={clearcoat}
        clearcoatRoughness={clearcoatRoughness}
        envMapIntensity={envMapIntensity}
      />
    </mesh>
  );
}

export function ModelCylinder({
  position,
  scale,
  color,
  rotation = [0, 0, 0],
  opacity = 1,
  metalness,
  roughness,
  emissive,
  emissiveIntensity,
  castShadow = true,
  selected = false,
  materialKind,
}: PartProps) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow
    >
      <primitive object={UNIT_CYLINDER} attach="geometry" />
      <PartMaterial
        color={color}
        opacity={opacity}
        metalness={metalness}
        roughness={roughness}
        emissive={selected ? palette.teal : emissive}
        emissiveIntensity={selected ? 0.22 : emissiveIntensity}
        materialKind={materialKind}
      />
    </mesh>
  );
}

function ModelSphere({
  position,
  scale,
  color,
  rotation = [0, 0, 0],
  opacity = 1,
  metalness,
  roughness,
  castShadow = true,
  materialKind,
}: PartProps) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow
    >
      <primitive object={UNIT_SPHERE} attach="geometry" />
      <PartMaterial
        color={color}
        opacity={opacity}
        metalness={metalness}
        roughness={roughness}
        materialKind={materialKind}
      />
    </mesh>
  );
}

function ModelTorus({
  position,
  scale,
  color,
  rotation = [Math.PI / 2, 0, 0],
  metalness,
  roughness,
  castShadow = true,
  materialKind,
}: PartProps) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow
    >
      <primitive object={UNIT_TORUS} attach="geometry" />
      <PartMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        materialKind={materialKind}
      />
    </mesh>
  );
}

function ModelCone({
  position,
  scale,
  color,
  rotation = [0, 0, 0],
  metalness,
  roughness,
  materialKind,
}: PartProps) {
  return (
    <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
      <primitive object={UNIT_CONE} attach="geometry" />
      <PartMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        materialKind={materialKind}
      />
    </mesh>
  );
}

function TubeBetween({
  start,
  end,
  radius,
  color,
  metalness = 0.2,
  roughness = 0.42,
  materialKind,
  opacity = 1,
}: {
  start: Vector3Tuple;
  end: Vector3Tuple;
  radius: number;
  color: string;
  metalness?: number;
  roughness?: number;
  materialKind?: MaterialKind;
  opacity?: number;
}) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const length = direction.length();
  const midpoint = from.clone().add(to).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return (
    <mesh
      position={[midpoint.x, midpoint.y, midpoint.z]}
      quaternion={quaternion}
      scale={[radius * 2, length, radius * 2]}
      castShadow
    >
      <primitive object={UNIT_CYLINDER} attach="geometry" />
      <PartMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        materialKind={materialKind}
        opacity={opacity}
      />
    </mesh>
  );
}

const curvedTubeGeometryCache = new Map<string, THREE.TubeGeometry>();

function CurvedTube({
  points,
  radius,
  color,
  materialKind,
  opacity = 1,
}: {
  points: Vector3Tuple[];
  radius: number;
  color: string;
  materialKind?: MaterialKind;
  opacity?: number;
}) {
  const key = `${points
    .flat()
    .map((value) => value.toFixed(3))
    .join("|")}|${radius.toFixed(3)}`;
  let geometry = curvedTubeGeometryCache.get(key);
  if (!geometry) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    geometry = new THREE.TubeGeometry(curve, 20, radius, 8, false);
    curvedTubeGeometryCache.set(key, geometry);
  }
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <PartMaterial color={color} opacity={opacity} materialKind={materialKind} />
    </mesh>
  );
}

function GlassFlask({
  position,
  scale,
  rotation = [0, 0, 0],
  neckLength = 0.22,
  liquidColor,
}: {
  position: Vector3Tuple;
  scale: Vector3Tuple;
  rotation?: Vector3Tuple;
  neckLength?: number;
  liquidColor?: string;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={FLASK_GEOMETRY} castShadow={false} receiveShadow>
        <PartMaterial color={palette.glass} opacity={0.32} materialKind="glass" />
      </mesh>
      <ModelCylinder
        position={[0, 0.5 + neckLength * 0.5, 0]}
        scale={[0.28, neckLength, 0.28]}
        color={palette.glass}
        opacity={0.3}
        materialKind="glass"
        castShadow={false}
      />
      <ModelTorus
        position={[0, 0.5 + neckLength, 0]}
        scale={[0.33, 0.33, 0.33]}
        color="#b7cfcc"
        materialKind="glass"
        rotation={[Math.PI / 2, 0, 0]}
        castShadow={false}
      />
      {liquidColor && (
        <ModelSphere
          position={[0, -0.22, 0]}
          scale={[0.76, 0.42, 0.76]}
          color={liquidColor}
          opacity={0.46}
          roughness={0.18}
          castShadow={false}
        />
      )}
    </group>
  );
}

function HelicalTube({
  position,
  radius,
  height,
  turns,
  tubeRadius,
  color,
}: {
  position: Vector3Tuple;
  radius: number;
  height: number;
  turns: number;
  tubeRadius: number;
  color: string;
}) {
  const pointCount = Math.max(20, Math.round(turns * 14));
  const points = Array.from({ length: pointCount + 1 }, (_, index): Vector3Tuple => {
    const progress = index / pointCount;
    const angle = progress * turns * Math.PI * 2;
    return [
      position[0] + Math.cos(angle) * radius,
      position[1] - height * 0.5 + progress * height,
      position[2] + Math.sin(angle) * radius,
    ];
  });
  return (
    <CurvedTube
      points={points}
      radius={tubeRadius}
      color={color}
      materialKind="glass"
      opacity={0.54}
    />
  );
}

function DialGauge({
  position,
  diameter,
  accent,
}: {
  position: Vector3Tuple;
  diameter: number;
  accent: string;
}) {
  return (
    <group>
      <ModelCylinder
        position={position}
        scale={[diameter, 0.018, diameter]}
        color={palette.steelDark}
        rotation={[Math.PI / 2, 0, 0]}
        materialKind="aluminum"
      />
      <ModelCylinder
        position={[position[0], position[1], position[2] + 0.011]}
        scale={[diameter * 0.82, 0.008, diameter * 0.82]}
        color="#edf1ec"
        rotation={[Math.PI / 2, 0, 0]}
        materialKind="porcelain"
        castShadow={false}
      />
      <TubeBetween
        start={[position[0], position[1], position[2] + 0.018]}
        end={[position[0] + diameter * 0.19, position[1] + diameter * 0.18, position[2] + 0.018]}
        radius={Math.max(0.002, diameter * 0.025)}
        color={accent}
      />
      <ModelCylinder
        position={[position[0], position[1], position[2] + 0.021]}
        scale={[diameter * 0.09, 0.006, diameter * 0.09]}
        color={palette.graphite}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow={false}
      />
    </group>
  );
}

function TrolleyCaster({ position, size }: { position: Vector3Tuple; size: number }) {
  return (
    <group position={position}>
      <ModelCylinder
        position={[0, size * 0.68, 0]}
        scale={[size * 0.38, size * 0.18, size * 0.38]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <ModelBox
        position={[0, size * 0.48, 0]}
        scale={[size * 0.68, size * 0.08, size * 0.42]}
        color={palette.steelDark}
        materialKind="aluminum"
        edgeRadius={size * 0.04}
      />
      {[-0.25, 0.25].map((x) => (
        <ModelBox
          key={x}
          position={[size * x, size * 0.27, 0]}
          scale={[size * 0.08, size * 0.42, size * 0.52]}
          color={palette.steelDark}
          materialKind="aluminum"
          edgeRadius={size * 0.03}
        />
      ))}
      <ModelCylinder
        position={[0, size * 0.2, 0]}
        scale={[size * 0.62, size * 0.64, size * 0.62]}
        color={palette.rubber}
        rotation={[0, 0, Math.PI / 2]}
        materialKind="rubber"
      />
      <ModelCylinder
        position={[0, size * 0.2, 0]}
        scale={[size * 0.19, size * 0.67, size * 0.19]}
        color={palette.steel}
        rotation={[0, 0, Math.PI / 2]}
        materialKind="stainless"
      />
    </group>
  );
}

function CasterAssembly({ position, size = 0.07 }: { position: Vector3Tuple; size?: number }) {
  return (
    <group position={position}>
      <ModelBox
        position={[0, size * 0.55, 0]}
        scale={[size * 0.26, size * 0.72, size * 0.26]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <ModelCylinder
        position={[0, size * 0.12, 0]}
        scale={[size, size * 0.32, size]}
        color={palette.rubber}
        rotation={[0, 0, Math.PI / 2]}
        materialKind="rubber"
      />
    </group>
  );
}

function VentArray({
  position,
  width,
  count,
  gap,
  vertical = false,
}: {
  position: Vector3Tuple;
  width: number;
  count: number;
  gap: number;
  vertical?: boolean;
}) {
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, index) => {
        const offset = (index - (count - 1) / 2) * gap;
        return (
          <ModelBox
            key={index}
            position={vertical ? [0, offset, 0] : [offset, 0, 0]}
            scale={vertical ? [width, gap * 0.34, 0.008] : [gap * 0.52, width, 0.008]}
            color={palette.graphite}
            sharp
            castShadow={false}
          />
        );
      })}
    </group>
  );
}

function StatusScreen({
  position,
  scale,
  accent,
}: {
  position: Vector3Tuple;
  scale: Vector3Tuple;
  accent: string;
}) {
  return (
    <>
      <ModelBox position={position} scale={scale} color={palette.screen} castShadow={false} />
      <ModelBox
        position={[position[0] - scale[0] * 0.24, position[1], position[2] + 0.004]}
        scale={[Math.max(0.018, scale[0] * 0.1), scale[1] * 0.42, 0.006]}
        color={accent}
        emissive={accent}
        emissiveIntensity={0.55}
        castShadow={false}
      />
    </>
  );
}

function Feet({ width, depth, y = 0.03 }: { width: number; depth: number; y?: number }) {
  const radius = Math.min(0.045, Math.max(0.018, Math.min(width, depth) * 0.04));
  return (
    <>
      {[-0.42, 0.42].flatMap((x) =>
        [-0.4, 0.4].map((z) => (
          <ModelCylinder
            key={`${x}-${z}`}
            position={[width * x, y, depth * z]}
            scale={[radius * 2, y * 2, radius * 2]}
            color={palette.rubber}
            castShadow={false}
          />
        )),
      )}
    </>
  );
}

function BenchModel({ id, width, depth, height, accent }: ModelProps & { id: string }) {
  const top = Math.min(0.1, Math.max(0.055, height * 0.1));
  const leg = Math.min(0.07, Math.max(0.04, width * 0.035));
  const isSink = id.includes("sink");
  const isIsland = id.includes("island");
  const isMobile = id === "mobile-bench";
  const isCorner = id === "corner-lab-bench";
  if (isCorner) {
    return (
      <>
        <ModelBox
          position={[0, height - top / 2, -depth * 0.28]}
          scale={[width, top, depth * 0.44]}
          color={palette.phenolic}
        />
        <ModelBox
          position={[-width * 0.28, height - top / 2, depth * 0.12]}
          scale={[width * 0.44, top, depth * 0.56]}
          color={palette.phenolic}
        />
        <ModelBox
          position={[-width * 0.37, height * 0.43, depth * 0.12]}
          scale={[width * 0.2, height * 0.76, depth * 0.42]}
          color={palette.coolPanel}
        />
        <ModelBox
          position={[width * 0.3, height * 0.43, -depth * 0.28]}
          scale={[width * 0.22, height * 0.76, depth * 0.32]}
          color={palette.coolPanel}
        />
      </>
    );
  }
  return (
    <>
      <ModelBox
        position={[0, height - top / 2, 0]}
        scale={[width, top, depth]}
        color={palette.phenolic}
        materialKind="phenolic"
        roughness={0.38}
        edgeRadius={0.006}
      />
      {!isIsland && !isMobile && (
        <ModelBox
          position={[0, height + 0.075, -depth * 0.48]}
          scale={[width * 0.98, 0.15, 0.035]}
          color={palette.steel}
          materialKind="stainless"
          edgeRadius={0.004}
        />
      )}
      <ModelBox
        position={[0, height - top - 0.025, -depth * 0.47]}
        scale={[width * 0.96, 0.05, 0.035]}
        color={accent}
        castShadow={false}
      />
      {[-0.43, 0.43].flatMap((x) =>
        [-0.37, 0.37].map((z) => (
          <ModelBox
            key={`${x}-${z}`}
            position={[width * x, height * 0.43, depth * z]}
            scale={[leg, height * 0.78, leg]}
            color={palette.steelDark}
            metalness={0.48}
          />
        )),
      )}
      <ModelBox
        position={[-width * 0.31, height * 0.38, 0]}
        scale={[width * 0.25, height * 0.68, depth * 0.78]}
        color={palette.powderWhite}
      />
      <ModelBox
        position={[width * 0.31, height * 0.38, 0]}
        scale={[width * 0.25, height * 0.68, depth * 0.78]}
        color={palette.powderWhite}
      />
      {!isMobile && (
        <>
          <ModelBox
            position={[0, 0.055, depth * 0.28]}
            scale={[width * 0.82, 0.11, depth * 0.19]}
            color={palette.graphite}
            materialKind="rubber"
            edgeRadius={0.003}
          />
          {[-0.36, -0.12, 0.12, 0.36].flatMap((x, panelIndex) =>
            (isIsland ? [1, -1] : [1]).map((side) => (
              <group key={`casework-${x}-${side}`}>
                <ModelBox
                  position={[width * x, height * 0.42, side * depth * 0.397]}
                  scale={[width * 0.205, height * 0.62, 0.024]}
                  color={panelIndex % 2 === 0 ? palette.powderWhite : palette.porcelain}
                  edgeRadius={0.003}
                  castShadow={false}
                />
                <ModelBox
                  position={[width * x, height * 0.58, side * depth * 0.414]}
                  scale={[width * 0.095, 0.018, 0.018]}
                  color={palette.steelDark}
                  materialKind="aluminum"
                  castShadow={false}
                />
                {panelIndex % 2 === 1 &&
                  [0.31, 0.43, 0.55].map((level) => (
                    <ModelBox
                      key={level}
                      position={[width * x, height * level, side * depth * 0.416]}
                      scale={[width * 0.19, 0.008, 0.008]}
                      color={palette.graphite}
                      sharp
                      castShadow={false}
                    />
                  ))}
              </group>
            )),
          )}
        </>
      )}
      {[-0.31, 0.31].map((x) => (
        <ModelBox
          key={x}
          position={[width * x, height * 0.42, depth * 0.397]}
          scale={[width * 0.17, 0.025, 0.018]}
          color={palette.steelDark}
          metalness={0.55}
          castShadow={false}
        />
      ))}
      {isIsland && (
        <>
          <ModelBox
            position={[0, height + 0.12, 0]}
            scale={[width * 0.42, 0.24, depth * 0.15]}
            color={palette.coolPanel}
          />
          <StatusScreen
            position={[0, height + 0.13, depth * 0.078]}
            scale={[width * 0.12, 0.07, 0.012]}
            accent={accent}
          />
        </>
      )}
      {isSink && (
        <>
          <ModelBox
            position={[-width * 0.18, height - 0.055, 0]}
            scale={[width * 0.27, 0.018, depth * 0.48]}
            color={palette.steelDark}
            materialKind="stainless"
          />
          {[-1, 1].map((side) => (
            <ModelBox
              key={`sink-side-${side}`}
              position={[-width * 0.18 + side * width * 0.132, height - 0.005, 0]}
              scale={[0.018, 0.11, depth * 0.48]}
              color={palette.steel}
              materialKind="stainless"
              edgeRadius={0.003}
            />
          ))}
          {[-1, 1].map((side) => (
            <ModelBox
              key={`sink-end-${side}`}
              position={[-width * 0.18, height - 0.005, side * depth * 0.235]}
              scale={[width * 0.27, 0.11, 0.018]}
              color={palette.steel}
              materialKind="stainless"
              edgeRadius={0.003}
            />
          ))}
          <TubeBetween
            start={[width * 0.05, height + 0.02, -depth * 0.08]}
            end={[width * 0.05, height + 0.27, -depth * 0.08]}
            radius={0.018}
            color={palette.steel}
          />
          <TubeBetween
            start={[width * 0.05, height + 0.27, -depth * 0.08]}
            end={[-width * 0.08, height + 0.27, -depth * 0.08]}
            radius={0.018}
            color={palette.steel}
          />
        </>
      )}
      {isMobile &&
        [-0.42, 0.42].flatMap((x) =>
          [-0.36, 0.36].map((z) => (
            <CasterAssembly
              key={`mobile-bench-caster-${x}-${z}`}
              position={[width * x, 0.005, depth * z]}
              size={0.075}
            />
          )),
        )}
    </>
  );
}

function TableModel({ id, width, depth, height, accent }: ModelProps & { id: string }) {
  const workstation = id === "computer-workstation";
  const office = id === "office-desk";
  const topThickness = Math.min(0.065, height * 0.09);
  const frameY = height - topThickness - 0.065;
  return (
    <>
      <ModelBox
        position={[0, height - topThickness / 2, 0]}
        scale={[width, topThickness, depth]}
        color={office ? palette.powderWhite : palette.phenolic}
        materialKind={office ? "powder" : "phenolic"}
        edgeRadius={0.006}
      />
      <ModelBox
        position={[0, height - topThickness - 0.012, 0]}
        scale={[width * 0.96, 0.024, depth * 0.92]}
        color={palette.steelDark}
        materialKind="aluminum"
        edgeRadius={0.003}
      />
      {[-0.43, 0.43].flatMap((x) =>
        [-0.38, 0.38].map((z) => (
          <ModelBox
            key={`${x}-${z}`}
            position={[width * x, height * 0.47, depth * z]}
            scale={[0.055, height * 0.9, 0.055]}
            color={palette.steelDark}
            materialKind="aluminum"
            edgeRadius={0.004}
          />
        )),
      )}
      {[-0.38, 0.38].map((z) => (
        <ModelBox
          key={`long-apron-${z}`}
          position={[0, frameY, depth * z]}
          scale={[width * 0.86, 0.075, 0.045]}
          color={palette.steelDark}
          materialKind="aluminum"
          edgeRadius={0.004}
        />
      ))}
      {[-0.43, 0.43].map((x) => (
        <ModelBox
          key={`side-apron-${x}`}
          position={[width * x, frameY, 0]}
          scale={[0.045, 0.075, depth * 0.72]}
          color={palette.steelDark}
          materialKind="aluminum"
          edgeRadius={0.004}
        />
      ))}
      <ModelBox
        position={[0, height * 0.27, -depth * 0.38]}
        scale={[width * 0.82, 0.045, 0.045]}
        color={palette.steelDark}
        materialKind="aluminum"
        edgeRadius={0.003}
      />
      {[-0.43, 0.43].flatMap((x) =>
        [-0.38, 0.38].map((z) => (
          <ModelCylinder
            key={`leveler-${x}-${z}`}
            position={[width * x, 0.025, depth * z]}
            scale={[0.075, 0.05, 0.075]}
            color={palette.rubber}
            materialKind="rubber"
          />
        )),
      )}
      {workstation && (
        <>
          <ModelBox
            position={[0, height + 0.44, -depth * 0.22]}
            scale={[width * 0.4, 0.6, 0.065]}
            color={palette.graphite}
            materialKind="rubber"
            edgeRadius={0.012}
          />
          <ModelBox
            position={[0, height + 0.44, -depth * 0.187]}
            scale={[width * 0.34, 0.5, 0.012]}
            color={palette.screen}
            emissive={accent}
            emissiveIntensity={0.16}
            materialKind="screen"
            castShadow={false}
          />
          <ModelBox
            position={[0, height + 0.12, -depth * 0.22]}
            scale={[0.055, 0.24, 0.055]}
            color={palette.steelDark}
            materialKind="aluminum"
          />
          <ModelBox
            position={[0, height + 0.015, -depth * 0.22]}
            scale={[width * 0.22, 0.025, depth * 0.16]}
            color={palette.steelDark}
            materialKind="aluminum"
          />
          <ModelBox
            position={[-width * 0.04, height + 0.015, depth * 0.1]}
            scale={[width * 0.4, 0.025, depth * 0.25]}
            color={palette.graphite}
            materialKind="rubber"
            edgeRadius={0.008}
          />
          <ModelCylinder
            position={[width * 0.25, height + 0.028, depth * 0.13]}
            scale={[0.07, 0.025, 0.1]}
            color={palette.graphite}
            materialKind="rubber"
          />
          <ModelBox
            position={[width * 0.31, height * 0.39, -depth * 0.16]}
            scale={[width * 0.22, height * 0.62, depth * 0.26]}
            color={palette.graphite}
            materialKind="rubber"
            edgeRadius={0.008}
          />
          <VentArray
            position={[width * 0.31, height * 0.43, -depth * 0.026]}
            width={height * 0.14}
            count={5}
            gap={width * 0.035}
            vertical
          />
          <CurvedTube
            points={[
              [0, height + 0.12, -depth * 0.25],
              [width * 0.18, height * 0.7, -depth * 0.34],
              [width * 0.3, height * 0.52, -depth * 0.25],
            ]}
            radius={0.008}
            color={palette.graphite}
            materialKind="rubber"
          />
        </>
      )}
    </>
  );
}

function SeatModel({ id, width, depth, height, accent }: ModelProps & { id: string }) {
  const chair = id.includes("chair");
  const office = id === "office-chair";
  const seatY = chair ? height * 0.48 : height * 0.74;
  return (
    <>
      {[-0.8, -0.4, 0, 0.4, 0.8].map((angle) => {
        const theta = angle * Math.PI;
        return (
          <TubeBetween
            key={angle}
            start={[0, height * 0.12, 0]}
            end={[Math.sin(theta) * width * 0.43, height * 0.06, Math.cos(theta) * depth * 0.43]}
            radius={0.018}
            color={palette.graphite}
          />
        );
      })}
      <ModelCylinder
        position={[0, seatY * 0.5, 0]}
        scale={[0.07, seatY * 0.82, 0.07]}
        color={palette.steelDark}
        metalness={0.4}
      />
      <ModelCylinder
        position={[0, seatY, 0]}
        scale={[width * 0.72, 0.09, depth * 0.72]}
        color={office ? accent : palette.graphite}
        roughness={0.42}
      />
      {!chair && (
        <ModelTorus
          position={[0, height * 0.43, 0]}
          scale={[width * 0.62, 0.055, depth * 0.62]}
          color={palette.steelDark}
          metalness={0.48}
        />
      )}
      {chair && (
        <>
          <TubeBetween
            start={[0, seatY + 0.02, -depth * 0.28]}
            end={[0, height * 0.76, -depth * 0.3]}
            radius={0.025}
            color={palette.steelDark}
          />
          <ModelBox
            position={[0, height * 0.82, -depth * 0.29]}
            scale={[width * 0.72, height * 0.3, 0.08]}
            color={office ? accent : palette.graphite}
            rotation={[-0.12, 0, 0]}
          />
        </>
      )}
    </>
  );
}

function CabinetModel({ id, width, depth, height, accent, detail }: ModelProps & { id: string }) {
  const drawers = id.includes("drawer") || id === "mobile-drawer";
  const glass = id === "glass-wall-cabinet";
  const cold = [
    "refrigerator-storage",
    "freezer-storage",
    "lab-refrigerator",
    "lab-freezer",
    "ultra-low-freezer",
  ].includes(id);
  const frontZ = depth / 2 + 0.012;
  const count = drawers
    ? id === "base-drawer-cabinet"
      ? 6
      : 4
    : cold
      ? 1
      : id === "locker"
        ? 3
        : 2;
  return (
    <>
      <ModelBox
        position={[0, height / 2 + 0.04, 0]}
        scale={[width, Math.max(0.08, height - 0.08), depth]}
        color={id === "flammable-cabinet" ? palette.yellow : palette.powderWhite}
        edgeRadius={0.006}
      />
      <ModelBox
        position={[0, 0.04, 0]}
        scale={[width * 0.9, 0.08, depth * 0.86]}
        color={palette.graphite}
      />
      {Array.from({ length: count }, (_, index) => {
        const panelHeight = drawers ? (height - 0.14) / count : height * 0.82;
        const panelWidth = drawers ? width * 0.93 : (width * 0.94) / count;
        const x = drawers ? 0 : -width * 0.47 + panelWidth * (index + 0.5);
        const y = drawers ? 0.1 + panelHeight * (index + 0.5) : height * 0.52;
        return (
          <group key={index}>
            <ModelBox
              position={[x, y, frontZ]}
              scale={[panelWidth - 0.012, Math.max(0.04, panelHeight - 0.018), 0.025]}
              color={
                glass ? palette.glass : id === "chemical-cabinet" ? "#65899a" : palette.porcelain
              }
              opacity={glass ? 0.38 : 1}
              materialKind={glass ? "glass" : "powder"}
              edgeRadius={glass ? 0.002 : 0.003}
              castShadow={!glass}
            />
            <ModelBox
              position={
                drawers
                  ? [0, y, frontZ + 0.025]
                  : [
                      x + (index < count / 2 ? panelWidth * 0.32 : -panelWidth * 0.32),
                      y,
                      frontZ + 0.025,
                    ]
              }
              scale={drawers ? [width * 0.28, 0.02, 0.02] : [0.022, height * 0.26, 0.022]}
              color={palette.steelDark}
              materialKind="aluminum"
              castShadow={false}
            />
            {drawers && index < count - 1 && (
              <ModelBox
                position={[0, y + panelHeight * 0.48, frontZ + 0.014]}
                scale={[width * 0.9, 0.006, 0.006]}
                color={palette.graphite}
                sharp
                castShadow={false}
              />
            )}
          </group>
        );
      })}
      {!drawers && count > 1 && (
        <ModelBox
          position={[0, height * 0.5, frontZ + 0.016]}
          scale={[0.018, height * 0.82, 0.018]}
          color={palette.steelDark}
          castShadow={false}
        />
      )}
      {cold && (
        <>
          <ModelBox
            position={[0, height * 0.52, frontZ - 0.008]}
            scale={[width * 0.94, height * 0.84, 0.018]}
            color={palette.graphite}
            materialKind="rubber"
            edgeRadius={0.003}
            castShadow={false}
          />
          <StatusScreen
            position={[width * 0.22, height * 0.77, frontZ + 0.028]}
            scale={[width * 0.22, 0.11, 0.014]}
            accent={accent}
          />
          <ModelBox
            position={[-width * 0.45, height * 0.53, frontZ + 0.035]}
            scale={[0.035, height * 0.56, 0.035]}
            color={palette.steelDark}
            metalness={0.52}
          />
          <VentArray
            position={[0, height * 0.12, frontZ + 0.032]}
            width={width * 0.28}
            count={detail === "preview" ? 7 : 4}
            gap={width * 0.08}
            vertical
          />
          {id === "ultra-low-freezer" &&
            [0.32, 0.68].map((level) => (
              <ModelBox
                key={level}
                position={[-width * 0.43, height * level, frontZ + 0.055]}
                scale={[0.05, 0.12, 0.05]}
                color={palette.graphite}
                materialKind="rubber"
              />
            ))}
          <group position={[0, height * 0.16, -depth * 0.506]} rotation={[0, Math.PI, 0]}>
            <VentArray
              position={[0, 0, 0]}
              width={width * 0.34}
              count={detail === "preview" ? 9 : 5}
              gap={width * 0.075}
              vertical
            />
          </group>
          {[-1, 1].map((side) => (
            <ModelBox
              key={`cold-standoff-${side}`}
              position={[side * width * 0.38, height * 0.82, -depth * 0.53]}
              scale={[0.055, 0.12, 0.055]}
              color={palette.steelDark}
              materialKind="aluminum"
            />
          ))}
        </>
      )}
      {glass && (
        <>
          {[0.28, 0.52, 0.76].map((level) => (
            <ModelBox
              key={level}
              position={[0, height * level, -depth * 0.04]}
              scale={[width * 0.84, 0.018, depth * 0.72]}
              color={palette.glass}
              materialKind="glass"
              opacity={0.32}
              edgeRadius={0.002}
              castShadow={false}
            />
          ))}
          {[-0.47, 0, 0.47].map((x) => (
            <ModelBox
              key={x}
              position={[width * x, height * 0.52, frontZ + 0.012]}
              scale={[0.022, height * 0.84, 0.022]}
              color={palette.steelDark}
              materialKind="aluminum"
              edgeRadius={0.002}
            />
          ))}
        </>
      )}
      {(id === "flammable-cabinet" || id === "chemical-cabinet") && (
        <ModelBox
          position={[0, height * 0.36, frontZ + 0.035]}
          scale={[width * 0.14, width * 0.14, 0.014]}
          color={id === "flammable-cabinet" ? palette.red : palette.yellow}
          rotation={[0, 0, Math.PI / 4]}
          castShadow={false}
        />
      )}
      {cold ? (
        <>
          {[-0.4, 0.4].flatMap((x) =>
            [-0.37, 0.37].map((z) => (
              <CasterAssembly
                key={`cold-caster-${x}-${z}`}
                position={[width * x, 0.004, depth * z]}
                size={0.065}
              />
            )),
          )}
          {[-0.3, 0.3].map((x) => (
            <ModelCylinder
              key={`cold-leveler-${x}`}
              position={[width * x, 0.025, depth * 0.43]}
              scale={[0.07, 0.05, 0.07]}
              color={palette.rubber}
              materialKind="rubber"
            />
          ))}
        </>
      ) : (
        <Feet width={width} depth={depth} />
      )}
    </>
  );
}

function ShelfModel({ id, width, depth, height, accent, detail }: ModelProps & { id: string }) {
  if (id === "pegboard") {
    return (
      <>
        <ModelBox
          position={[0, height / 2, 0]}
          scale={[width, height, Math.max(0.04, depth)]}
          color={palette.graphite}
        />
        {[-0.32, 0, 0.32].flatMap((x) =>
          [-0.3, 0, 0.3].map((y) => (
            <ModelCylinder
              key={`${x}-${y}`}
              position={[width * x, height * (0.5 + y), depth * 0.55]}
              scale={[0.035, 0.06, 0.035]}
              color={accent}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow={false}
            />
          )),
        )}
      </>
    );
  }
  const slotted = id === "slotted-angle-storage-rack";
  return (
    <>
      {[0.06, 0.34, 0.62, 0.94].map((level) => (
        <ModelBox
          key={level}
          position={[0, height * level, 0]}
          scale={[width, 0.055, depth]}
          color={slotted ? "#85775f" : level === 0.94 ? accent : palette.steel}
          materialKind={slotted ? "painted" : "stainless"}
        />
      ))}
      {[-0.47, 0.47].flatMap((x) =>
        [-0.43, 0.43].map((z) => (
          <ModelBox
            key={`${x}-${z}`}
            position={[width * x, height / 2, depth * z]}
            scale={[0.055, height, 0.055]}
            color={slotted ? "#9b8b6d" : palette.steelDark}
            materialKind={slotted ? "painted" : "aluminum"}
          />
        )),
      )}
      <TubeBetween
        start={[-width * 0.47, height * 0.15, -depth * 0.44]}
        end={[width * 0.47, height * 0.84, -depth * 0.44]}
        radius={0.015}
        color={palette.steelDark}
      />
      <TubeBetween
        start={[width * 0.47, height * 0.15, -depth * 0.44]}
        end={[-width * 0.47, height * 0.84, -depth * 0.44]}
        radius={0.015}
        color={palette.steelDark}
      />
      {slotted &&
        detail === "preview" &&
        [-0.47, 0.47].flatMap((x) =>
          [0.18, 0.36, 0.54, 0.72, 0.9].map((level) => (
            <ModelBox
              key={`slot-${x}-${level}`}
              position={[width * x, height * level, depth * 0.442]}
              scale={[0.022, 0.06, 0.009]}
              color={palette.graphite}
              sharp
              castShadow={false}
            />
          )),
        )}
    </>
  );
}

function HoodModel({ id, width, depth, height, accent, detail }: ModelProps & { id: string }) {
  const bsc = id === "biosafety-cabinet";
  const blackFrame = id === "fume-hood";
  const baseHeight = height * 0.34;
  const chamberBottom = baseHeight + 0.08;
  const chamberHeight = height * 0.42;
  return (
    <>
      <ModelBox
        position={[0, baseHeight / 2, 0]}
        scale={[width * 0.96, baseHeight, depth * 0.92]}
        color={palette.powderWhite}
      />
      <ModelBox
        position={[0, 0.045, depth * 0.35]}
        scale={[width * 0.82, 0.09, depth * 0.16]}
        color={palette.graphite}
        castShadow={false}
      />
      {[-0.235, 0.235].map((x) => (
        <group key={`base-door-${x}`}>
          <ModelBox
            position={[width * x, baseHeight * 0.53, depth * 0.468]}
            scale={[width * 0.43, baseHeight * 0.72, 0.026]}
            color={palette.porcelain}
            castShadow={false}
          />
          <ModelBox
            position={[width * (x + (x < 0 ? 0.17 : -0.17)), baseHeight * 0.55, depth * 0.489]}
            scale={[0.018, baseHeight * 0.28, 0.022]}
            color={palette.steelDark}
            metalness={0.72}
            castShadow={false}
          />
        </group>
      ))}
      <ModelBox
        position={[0, baseHeight + 0.04, 0]}
        scale={[width, 0.08, depth]}
        color={palette.phenolic}
      />
      <ModelBox
        position={[0, chamberBottom + chamberHeight / 2, -depth * 0.43]}
        scale={[width * 0.88, chamberHeight, 0.06]}
        color={blackFrame ? palette.graphite : palette.coolPanel}
      />
      {[-0.26, 0, 0.26].map((x) => (
        <ModelBox
          key={`baffle-${x}`}
          position={[width * x, chamberBottom + chamberHeight * 0.5, -depth * 0.468]}
          scale={[width * 0.12, chamberHeight * 0.58, 0.014]}
          color={palette.steelDark}
          opacity={0.38}
          castShadow={false}
        />
      ))}
      {[-0.47, 0.47].map((x) => (
        <ModelBox
          key={x}
          position={[width * x, chamberBottom + chamberHeight / 2, 0]}
          scale={[width * 0.06, chamberHeight, depth]}
          color={blackFrame ? palette.graphite : palette.powderWhite}
          edgeRadius={0.006}
        />
      ))}
      <ModelBox
        position={[0, chamberBottom + chamberHeight * 0.58, depth * 0.43]}
        scale={[width * 0.82, chamberHeight * 0.76, 0.035]}
        color={palette.glass}
        materialKind="glass"
        opacity={0.34}
        roughness={0.08}
        castShadow={false}
      />
      {[-0.43, 0.43].map((x) => (
        <ModelBox
          key={`sash-rail-${x}`}
          position={[width * x, chamberBottom + chamberHeight * 0.58, depth * 0.455]}
          scale={[0.028, chamberHeight * 0.8, 0.03]}
          color={palette.graphite}
          materialKind="rubber"
          edgeRadius={0.003}
        />
      ))}
      <ModelBox
        position={[0, chamberBottom + chamberHeight * 0.22, depth * 0.46]}
        scale={[width * 0.68, 0.035, 0.035]}
        color={palette.steelDark}
        metalness={0.5}
      />
      <ModelBox
        position={[0, height * 0.86, 0]}
        scale={[width, height * 0.22, depth * 0.96]}
        color={blackFrame ? palette.graphite : palette.powderWhite}
        edgeRadius={0.012}
      />
      {[-0.28, -0.14, 0, 0.14].map((x) => (
        <ModelBox
          key={`canopy-vent-${x}`}
          position={[width * x, height * 0.91, depth * 0.487]}
          scale={[width * 0.08, 0.018, 0.012]}
          color={palette.steelDark}
          castShadow={false}
        />
      ))}
      <ModelBox
        position={[0, height * 0.76, depth * 0.48]}
        scale={[width * 0.9, 0.04, 0.025]}
        color={palette.steelDark}
        materialKind="aluminum"
        castShadow={false}
      />
      <ModelBox
        position={[0, chamberBottom + 0.02, depth * 0.472]}
        scale={[width * 0.86, 0.045, 0.035]}
        color={palette.steel}
        materialKind="stainless"
        edgeRadius={0.004}
      />
      <StatusScreen
        position={[width * 0.34, height * 0.84, depth * 0.49]}
        scale={[width * 0.18, 0.1, 0.018]}
        accent={accent}
      />
      {!bsc && (
        <ModelCylinder
          position={[0, height + 0.05, -depth * 0.1]}
          scale={[width * 0.18, 0.1, width * 0.18]}
          color={palette.steelDark}
          metalness={0.38}
        />
      )}
      {bsc && (
        <>
          {[-0.26, 0, 0.26].map((x) => (
            <ModelBox
              key={x}
              position={[width * x, height * 0.93, depth * 0.48]}
              scale={[width * 0.18, 0.035, 0.02]}
              color={palette.steelDark}
              castShadow={false}
            />
          ))}
        </>
      )}
      {blackFrame && (
        <>
          {[-0.3, -0.1, 0.1, 0.3].map((x) => (
            <ModelCylinder
              key={`service-${x}`}
              position={[width * x, chamberBottom + 0.12, depth * 0.467]}
              scale={[0.035, 0.018, 0.035]}
              color={x < 0 ? palette.yellow : palette.red}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow={false}
            />
          ))}
          {detail === "preview" && (
            <VentArray
              position={[0, height * 0.91, depth * 0.489]}
              width={height * 0.045}
              count={7}
              gap={width * 0.09}
              vertical
            />
          )}
        </>
      )}
    </>
  );
}

function CentrifugeModel({
  id,
  width,
  depth,
  height,
  accent,
  detail,
}: ModelProps & { id: string }) {
  const floor = id === "floor-centrifuge";
  const micro = id === "microcentrifuge";
  const bodyHeight = height * (floor ? 0.78 : 0.72);
  return (
    <>
      <ModelBox
        position={[0, bodyHeight / 2 + 0.03, 0]}
        scale={[width, bodyHeight, depth]}
        color={palette.powderWhite}
        edgeRadius={Math.min(0.028, height * 0.08)}
      />
      <ModelBox
        position={[0, bodyHeight * 0.18, depth * 0.48]}
        scale={[width * 0.86, bodyHeight * 0.23, 0.024]}
        color={palette.coolPanel}
        edgeRadius={0.004}
        castShadow={false}
      />
      <ModelCylinder
        position={[0, bodyHeight + 0.025, -depth * 0.03]}
        scale={[width * (micro ? 0.7 : 0.78), 0.07, depth * (micro ? 0.62 : 0.72)]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <ModelCylinder
        position={[0, bodyHeight + 0.065, -depth * 0.03]}
        scale={[width * 0.58, 0.025, depth * 0.53]}
        color={palette.graphite}
        materialKind="rubber"
        castShadow={false}
      />
      <ModelTorus
        position={[0, bodyHeight + 0.075, -depth * 0.03]}
        scale={[width * 0.66, 0.035, depth * 0.6]}
        color={palette.rubber}
        materialKind="rubber"
      />
      <ModelBox
        position={[0, bodyHeight * 0.67, depth / 2 + 0.018]}
        scale={[width * 0.76, bodyHeight * 0.28, 0.035]}
        color={palette.graphite}
        rotation={[-0.12, 0, 0]}
      />
      <StatusScreen
        position={[-width * 0.16, bodyHeight * 0.68, depth / 2 + 0.042]}
        scale={[width * 0.25, bodyHeight * 0.11, 0.014]}
        accent={accent}
      />
      {[0.08, 0.22].map((x) => (
        <ModelCylinder
          key={x}
          position={[width * x, bodyHeight * 0.67, depth / 2 + 0.048]}
          scale={[0.035, 0.018, 0.035]}
          color={x > 0.1 ? palette.teal : palette.coolPanel}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow={false}
        />
      ))}
      <ModelBox
        position={[0, bodyHeight + 0.04, -depth * 0.38]}
        scale={[width * 0.36, 0.06, 0.055]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <VentArray
        position={[0, bodyHeight * 0.24, depth / 2 + 0.031]}
        width={bodyHeight * 0.14}
        count={detail === "preview" ? 7 : 4}
        gap={width * 0.09}
        vertical
      />
      <Feet width={width} depth={depth} y={floor ? 0.035 : 0.02} />
    </>
  );
}

function MicroscopeModel({
  id,
  width,
  depth,
  height,
  accent,
  detail,
}: ModelProps & { id: string }) {
  const stereo = id === "stereo-microscope";
  return (
    <>
      <ModelBox
        position={[0, height * 0.085, depth * 0.05]}
        scale={[width * 0.92, height * 0.17, depth * 0.8]}
        color={palette.porcelain}
        rotation={[-0.035, 0, 0]}
        edgeRadius={0.018}
      />
      <ModelBox
        position={[0, height * 0.03, depth * 0.07]}
        scale={[width * 0.78, height * 0.055, depth * 0.66]}
        color={palette.graphite}
        materialKind="rubber"
        edgeRadius={0.01}
      />
      <TubeBetween
        start={[-width * 0.18, height * 0.16, -depth * 0.18]}
        end={[-width * 0.11, height * 0.66, -depth * 0.2]}
        radius={Math.min(0.06, width * 0.13)}
        color={palette.powderWhite}
      />
      <TubeBetween
        start={[-width * 0.11, height * 0.66, -depth * 0.2]}
        end={[width * 0.08, height * 0.78, -depth * 0.08]}
        radius={Math.min(0.055, width * 0.12)}
        color={palette.powderWhite}
      />
      <ModelBox
        position={[0, height * 0.43, depth * 0.03]}
        scale={[width * 0.66, 0.045, depth * 0.48]}
        color={palette.graphite}
        metalness={0.18}
        edgeRadius={0.004}
      />
      {detail === "preview" &&
        [-0.22, 0.22].map((x) => (
          <ModelBox
            key={`stage-clip-${x}`}
            position={[width * x, height * 0.465, depth * 0.04]}
            scale={[width * 0.12, 0.015, depth * 0.035]}
            color={palette.steel}
            materialKind="stainless"
            edgeRadius={0.002}
          />
        ))}
      <ModelCylinder
        position={[0, height * 0.34, depth * 0.02]}
        scale={[width * 0.2, 0.035, width * 0.2]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <ModelCylinder
        position={[width * 0.08, height * 0.65, -depth * 0.02]}
        scale={[width * 0.3, 0.08, width * 0.3]}
        color={palette.steelDark}
      />
      {[-0.12, 0, 0.12].map((x, index) => (
        <ModelCone
          key={x}
          position={[width * (0.08 + x), height * (0.53 - index * 0.015), depth * 0.02]}
          scale={[0.045, height * 0.2, 0.045]}
          color={index === 1 ? accent : palette.graphite}
          rotation={[0.18, 0, index === 0 ? 0.14 : index === 2 ? -0.14 : 0]}
        />
      ))}
      <TubeBetween
        start={[width * 0.02, height * 0.7, -depth * 0.09]}
        end={[-width * 0.09, height * 0.91, -depth * 0.17]}
        radius={0.028}
        color={palette.powderWhite}
      />
      <TubeBetween
        start={[width * 0.12, height * 0.7, -depth * 0.09]}
        end={[width * 0.2, height * 0.91, -depth * 0.17]}
        radius={0.028}
        color={palette.powderWhite}
      />
      {[-0.09, 0.2].map((x) => (
        <ModelCylinder
          key={x}
          position={[width * x, height * 0.94, -depth * 0.18]}
          scale={[0.065, stereo ? 0.14 : 0.11, 0.065]}
          color={palette.rubber}
          rotation={[0.38, 0, 0]}
        />
      ))}
      {[-0.24, 0.24].map((x) => (
        <group key={x}>
          <ModelCylinder
            position={[width * x, height * 0.49, -depth * 0.12]}
            scale={[0.085, 0.052, 0.085]}
            color={palette.graphite}
            rotation={[0, 0, Math.PI / 2]}
            materialKind="rubber"
          />
          <ModelCylinder
            position={[width * x, height * 0.49, -depth * 0.12]}
            scale={[0.045, 0.058, 0.045]}
            color={accent}
            rotation={[0, 0, Math.PI / 2]}
          />
        </group>
      ))}
    </>
  );
}

function BalanceModel({ id, width, depth, height, accent }: ModelProps & { id: string }) {
  const analytical = id === "analytical-balance";
  const baseHeight = analytical ? height * 0.22 : height * 0.48;
  return (
    <>
      <ModelBox
        position={[0, baseHeight / 2, 0]}
        scale={[width, baseHeight, depth]}
        color={palette.powderWhite}
      />
      <ModelCylinder
        position={[0, baseHeight + 0.025, -depth * 0.08]}
        scale={[width * 0.5, 0.035, width * 0.5]}
        color={palette.steel}
        metalness={0.55}
      />
      <StatusScreen
        position={[0, baseHeight * 0.55, depth / 2 + 0.018]}
        scale={[width * 0.52, baseHeight * 0.28, 0.014]}
        accent={accent}
      />
      {analytical && (
        <>
          {[-0.43, 0.43].flatMap((x) =>
            [-0.38, 0.38].map((z) => (
              <ModelBox
                key={`${x}-${z}`}
                position={[width * x, baseHeight + (height - baseHeight) / 2, depth * z]}
                scale={[0.025, height - baseHeight, 0.025]}
                color={palette.steelDark}
                metalness={0.42}
              />
            )),
          )}
          <ModelBox
            position={[0, baseHeight + (height - baseHeight) / 2, depth * 0.4]}
            scale={[width * 0.84, height - baseHeight, 0.02]}
            color={palette.glass}
            opacity={0.26}
            castShadow={false}
          />
          <ModelBox
            position={[0, baseHeight + (height - baseHeight) / 2, -depth * 0.4]}
            scale={[width * 0.84, height - baseHeight, 0.02]}
            color={palette.glass}
            opacity={0.2}
            castShadow={false}
          />
          <ModelBox
            position={[0, height - 0.025, 0]}
            scale={[width * 0.9, 0.05, depth * 0.84]}
            color={palette.coolPanel}
          />
        </>
      )}
    </>
  );
}

function ThermalCabinetModel({
  id,
  width,
  depth,
  height,
  accent,
  detail,
}: ModelProps & { id: string }) {
  const shaker = id === "shaking-incubator";
  const glassDoor = id.includes("incubator");
  const frontZ = depth / 2 + 0.016;
  return (
    <>
      <ModelBox
        position={[0, height / 2, 0]}
        scale={[width, height, depth]}
        color={palette.powderWhite}
      />
      <ModelBox
        position={[0, height * 0.48, frontZ]}
        scale={[width * 0.88, height * 0.68, 0.03]}
        color={glassDoor ? palette.glass : palette.porcelain}
        opacity={glassDoor ? 0.32 : 1}
        castShadow={!glassDoor}
      />
      {glassDoor && (
        <>
          <ModelBox
            position={[0, height * 0.48, frontZ - 0.035]}
            scale={[width * 0.79, height * 0.59, 0.025]}
            color={palette.graphite}
            materialKind="rubber"
            edgeRadius={0.006}
            castShadow={false}
          />
          {[0.3, 0.46, 0.62].slice(0, detail === "preview" ? 3 : 2).map((level) => (
            <ModelBox
              key={level}
              position={[0, height * level, frontZ - 0.07]}
              scale={[width * 0.68, 0.018, depth * 0.48]}
              color={palette.steel}
              materialKind="stainless"
              edgeRadius={0.002}
            />
          ))}
        </>
      )}
      <ModelBox
        position={[width * 0.4, height * 0.5, frontZ + 0.03]}
        scale={[0.035, height * 0.5, 0.035]}
        color={palette.steelDark}
        metalness={0.48}
      />
      <StatusScreen
        position={[width * 0.23, height * 0.88, frontZ + 0.03]}
        scale={[width * 0.28, height * 0.09, 0.015]}
        accent={accent}
      />
      {Array.from({ length: 4 }, (_, index) => (
        <ModelBox
          key={index}
          position={[-width * 0.22 + index * width * 0.14, height * 0.08, frontZ + 0.028]}
          scale={[width * 0.09, 0.02, 0.012]}
          color={palette.steelDark}
          castShadow={false}
        />
      ))}
      {shaker && (
        <ModelBox
          position={[0, height * 0.6, 0]}
          scale={[width * 0.56, 0.05, depth * 0.48]}
          color={accent}
          metalness={0.22}
        />
      )}
      <Feet width={width} depth={depth} />
    </>
  );
}

function AutoclaveModel({ width, depth, height, accent }: ModelProps) {
  const frontZ = depth / 2 + 0.018;
  const lidDiameter = Math.min(width, depth) * 0.68;
  return (
    <>
      <ModelBox
        position={[0, height * 0.47, 0]}
        scale={[width, height * 0.9, depth]}
        color={palette.powderWhite}
        materialKind="powder"
        edgeRadius={0.018}
      />
      <ModelCylinder
        position={[0, height * 0.91, 0]}
        scale={[lidDiameter, height * 0.09, lidDiameter]}
        color={palette.steelDark}
        materialKind="stainless"
      />
      <ModelCylinder
        position={[0, height * 0.96, 0]}
        scale={[lidDiameter * 0.88, height * 0.045, lidDiameter * 0.88]}
        color={palette.steel}
        materialKind="stainless"
      />
      <ModelTorus
        position={[0, height * 0.985, 0]}
        scale={[lidDiameter * 0.79, 0.05, lidDiameter * 0.79]}
        color={palette.rubber}
        materialKind="rubber"
      />
      <ModelBox
        position={[0, height * 0.98, -depth * 0.34]}
        scale={[width * 0.28, 0.1, depth * 0.12]}
        color={palette.steelDark}
        materialKind="aluminum"
        edgeRadius={0.008}
      />
      <TubeBetween
        start={[-width * 0.24, height * 1.04, depth * 0.05]}
        end={[width * 0.24, height * 1.04, depth * 0.05]}
        radius={0.028}
        color={palette.steelDark}
        metalness={0.7}
      />
      <ModelBox
        position={[0, height * 0.68, frontZ]}
        scale={[width * 0.78, height * 0.24, 0.035]}
        color={palette.graphite}
        materialKind="rubber"
        edgeRadius={0.008}
      />
      <StatusScreen
        position={[-width * 0.14, height * 0.69, frontZ + 0.022]}
        scale={[width * 0.32, height * 0.1, 0.014]}
        accent={accent}
      />
      {[0.16, 0.28].map((x, index) => (
        <ModelCylinder
          key={`autoclave-control-${x}`}
          position={[width * x, height * 0.69, frontZ + 0.028]}
          scale={[0.036, 0.014, 0.036]}
          color={index ? palette.red : palette.teal}
          rotation={[Math.PI / 2, 0, 0]}
          materialKind="painted"
          castShadow={false}
        />
      ))}
      <VentArray
        position={[0, height * 0.22, frontZ + 0.022]}
        width={height * 0.16}
        count={7}
        gap={width * 0.085}
        vertical
      />
      <ModelCylinder
        position={[width * 0.3, height * 0.24, -depth * 0.51]}
        scale={[0.045, 0.065, 0.045]}
        color={palette.steelDark}
        rotation={[Math.PI / 2, 0, 0]}
        materialKind="stainless"
      />
      <CurvedTube
        points={[
          [width * 0.3, height * 0.24, -depth * 0.54],
          [width * 0.4, height * 0.16, -depth * 0.58],
          [width * 0.37, height * 0.04, -depth * 0.5],
        ]}
        radius={0.012}
        color={palette.graphite}
        materialKind="rubber"
      />
      {[-0.4, 0.4].flatMap((x) =>
        [-0.38, 0.38].map((z) => (
          <CasterAssembly
            key={`autoclave-caster-${x}-${z}`}
            position={[width * x, 0.004, depth * z]}
            size={0.065}
          />
        )),
      )}
    </>
  );
}

function BenchInstrumentModel({
  id,
  width,
  depth,
  height,
  accent,
  detail,
}: ModelProps & { id: string }) {
  const frontZ = depth / 2 + 0.015;
  const pcr = id === "pcr-machine" || id === "real-time-pcr";
  const water = id === "water-bath" || id === "electrophoresis-tank";
  const hotplate = id === "hotplate-stirrer" || id === "dry-block-heater";
  const gelDoc = id === "gel-doc";
  const printer = id === "printer";
  return (
    <>
      <ModelBox
        position={[0, height * 0.42, 0]}
        scale={[width, height * 0.84, depth]}
        color={gelDoc ? palette.graphite : palette.powderWhite}
      />
      {pcr && (
        <>
          <ModelBox
            position={[0, height * 0.9, -depth * 0.07]}
            scale={[width * 0.86, height * 0.18, depth * 0.76]}
            color={accent}
            rotation={[-0.08, 0, 0]}
          />
          {id === "real-time-pcr" && (
            <ModelBox
              position={[0, height * 0.77, -depth * 0.24]}
              scale={[width * 0.7, height * 0.28, depth * 0.22]}
              color={palette.graphite}
            />
          )}
        </>
      )}
      {water && (
        <>
          <ModelBox
            position={[0, height * 0.86, 0]}
            scale={[width * 0.82, 0.045, depth * 0.72]}
            color={palette.steelDark}
            metalness={0.52}
          />
          <ModelBox
            position={[0, height * 0.9, 0]}
            scale={[width * 0.72, 0.025, depth * 0.62]}
            color={id === "electrophoresis-tank" ? palette.glass : "#688e91"}
            opacity={id === "electrophoresis-tank" ? 0.42 : 1}
            castShadow={false}
          />
          {id === "electrophoresis-tank" && (
            <>
              <ModelCylinder
                position={[-width * 0.32, height * 0.98, depth * 0.2]}
                scale={[0.035, 0.055, 0.035]}
                color={palette.red}
              />
              <ModelCylinder
                position={[width * 0.32, height * 0.98, depth * 0.2]}
                scale={[0.035, 0.055, 0.035]}
                color={palette.graphite}
              />
            </>
          )}
        </>
      )}
      {hotplate && (
        <>
          <ModelBox
            position={[0, height * 0.88, -depth * 0.04]}
            scale={[width * 0.78, 0.035, depth * 0.7]}
            color={id === "hotplate-stirrer" ? palette.graphite : palette.steelDark}
            metalness={0.35}
          />
          {id === "dry-block-heater" &&
            [-0.22, 0, 0.22].flatMap((x) =>
              [-0.18, 0.08].map((z) => (
                <ModelCylinder
                  key={`${x}-${z}`}
                  position={[width * x, height * 0.92, depth * z]}
                  scale={[0.035, 0.018, 0.035]}
                  color={palette.graphite}
                  castShadow={false}
                />
              )),
            )}
        </>
      )}
      {gelDoc && (
        <>
          <ModelBox
            position={[0, height * 0.45, frontZ]}
            scale={[width * 0.74, height * 0.58, 0.035]}
            color="#171d21"
          />
          <ModelBox
            position={[0, height * 0.79, -depth * 0.2]}
            scale={[width * 0.46, height * 0.28, depth * 0.34]}
            color={accent}
          />
        </>
      )}
      {printer && (
        <>
          <ModelBox
            position={[0, height * 0.82, -depth * 0.1]}
            scale={[width * 0.8, 0.05, depth * 0.62]}
            color={palette.coolPanel}
          />
          <ModelBox
            position={[0, height * 0.58, frontZ]}
            scale={[width * 0.64, 0.04, 0.04]}
            color={palette.graphite}
          />
        </>
      )}
      {!water && !hotplate && !gelDoc && (
        <StatusScreen
          position={[-width * 0.2, height * 0.5, frontZ + 0.02]}
          scale={[width * 0.28, Math.max(0.055, height * 0.14), 0.014]}
          accent={accent}
        />
      )}
      {detail === "preview" &&
        [0.06, 0.16, 0.26].map((x) => (
          <ModelBox
            key={x}
            position={[width * x, height * 0.5, frontZ + 0.023]}
            scale={[0.018, 0.018, 0.01]}
            color={x === 0.26 ? accent : palette.steelDark}
            castShadow={false}
          />
        ))}
      <Feet width={width} depth={depth} y={0.018} />
    </>
  );
}

function WasherModel({ width, depth, height, accent }: ModelProps) {
  const frontZ = depth / 2 + 0.02;
  return (
    <>
      <ModelBox
        position={[0, height / 2, 0]}
        scale={[width, height, depth]}
        color={palette.steel}
        metalness={0.4}
      />
      <ModelBox
        position={[0, height * 0.48, frontZ]}
        scale={[width * 0.76, height * 0.58, 0.035]}
        color={palette.graphite}
      />
      <ModelBox
        position={[0, height * 0.48, frontZ + 0.025]}
        scale={[width * 0.64, height * 0.48, 0.012]}
        color={palette.glass}
        opacity={0.28}
        castShadow={false}
      />
      <StatusScreen
        position={[width * 0.2, height * 0.88, frontZ + 0.025]}
        scale={[width * 0.28, 0.09, 0.014]}
        accent={accent}
      />
    </>
  );
}

function VacuumPumpModel({ width, depth, height, accent, detail }: ModelProps) {
  const pumpYellow = "#c79b35";
  return (
    <>
      <ModelBox
        position={[0, height * 0.1, 0]}
        scale={[width, height * 0.2, depth]}
        color={palette.graphite}
      />
      <ModelCylinder
        position={[-width * 0.15, height * 0.48, 0]}
        scale={[height * 0.48, width * 0.55, height * 0.48]}
        color={pumpYellow}
        rotation={[0, 0, Math.PI / 2]}
        materialKind="painted"
      />
      <ModelBox
        position={[width * 0.28, height * 0.48, 0]}
        scale={[width * 0.26, height * 0.52, depth * 0.72]}
        color={pumpYellow}
        edgeRadius={0.012}
      />
      <TubeBetween
        start={[-width * 0.36, height * 0.72, -depth * 0.28]}
        end={[width * 0.26, height * 0.82, -depth * 0.28]}
        radius={0.022}
        color={palette.graphite}
      />
      <ModelCylinder
        position={[width * 0.12, height * 0.82, -depth * 0.08]}
        scale={[width * 0.14, height * 0.34, width * 0.14]}
        color="#b69355"
        materialKind="painted"
      />
      <ModelCylinder
        position={[width * 0.12, height * 0.98, -depth * 0.08]}
        scale={[width * 0.18, 0.035, width * 0.18]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <TubeBetween
        start={[width * 0.08, height * 0.64, depth * 0.2]}
        end={[width * 0.35, height * 0.72, depth * 0.25]}
        radius={0.018}
        color="#9b7441"
        metalness={0.6}
      />
      {detail === "preview" && (
        <StatusScreen
          position={[width * 0.28, height * 0.48, depth * 0.371]}
          scale={[width * 0.14, height * 0.12, 0.01]}
          accent={accent}
        />
      )}
      <Feet width={width} depth={depth} y={0.02} />
    </>
  );
}

function RotaryEvaporatorModel({ width, depth, height, accent, detail }: ModelProps) {
  const bathDiameter = Math.min(width * 0.42, depth * 0.48);
  const condenserX = -width * 0.25;
  const condenserZ = -depth * 0.08;
  const glassBlue = "#d9eeeb";
  return (
    <>
      <ModelBox
        position={[0, 0.045, 0]}
        scale={[width * 0.88, 0.09, depth * 0.78]}
        color={palette.porcelain}
        edgeRadius={0.014}
      />
      <ModelBox
        position={[0, 0.088, depth * 0.03]}
        scale={[width * 0.8, 0.012, depth * 0.67]}
        color={palette.coolPanel}
        roughness={0.38}
        edgeRadius={0.004}
      />
      <ModelCylinder
        position={[-width * 0.3, height * 0.5, -depth * 0.12]}
        scale={[0.046, height * 0.8, 0.046]}
        color={palette.steel}
        materialKind="stainless"
      />
      <ModelCylinder
        position={[-width * 0.3, height * 0.09, -depth * 0.12]}
        scale={[0.12, 0.035, 0.12]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <ModelBox
        position={[-width * 0.3, height * 0.61, -depth * 0.12]}
        scale={[width * 0.13, height * 0.18, depth * 0.18]}
        color={palette.graphite}
        edgeRadius={0.012}
      />
      <ModelCylinder
        position={[-width * 0.21, height * 0.61, -depth * 0.12]}
        scale={[0.055, width * 0.12, 0.055]}
        color={palette.steelDark}
        rotation={[0, 0, Math.PI / 2]}
        materialKind="aluminum"
      />
      <ModelCylinder
        position={[width * 0.18, height * 0.19, depth * 0.08]}
        scale={[bathDiameter, height * 0.22, bathDiameter]}
        color={palette.porcelain}
      />
      <ModelCylinder
        position={[width * 0.18, height * 0.29, depth * 0.08]}
        scale={[bathDiameter * 0.9, 0.032, bathDiameter * 0.9]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <ModelCylinder
        position={[width * 0.18, height * 0.3, depth * 0.08]}
        scale={[bathDiameter * 0.78, 0.022, bathDiameter * 0.78]}
        color={palette.steel}
        materialKind="stainless"
      />
      <ModelCylinder
        position={[width * 0.18, height * 0.313, depth * 0.08]}
        scale={[bathDiameter * 0.67, 0.01, bathDiameter * 0.67]}
        color="#43615d"
        roughness={0.16}
        castShadow={false}
      />
      <ModelBox
        position={[width * 0.18, height * 0.13, depth * 0.305]}
        scale={[width * 0.19, height * 0.08, 0.018]}
        color={palette.graphite}
        edgeRadius={0.006}
      />
      {[-0.055, 0.055].map((x) => (
        <ModelCylinder
          key={x}
          position={[width * 0.18 + x, height * 0.13, depth * 0.317]}
          scale={[0.027, 0.014, 0.027]}
          color={x < 0 ? accent : palette.steel}
          rotation={[Math.PI / 2, 0, 0]}
          materialKind={x < 0 ? "painted" : "stainless"}
          castShadow={false}
        />
      ))}
      <ModelBox
        position={[-width * 0.08, height * 0.67, -depth * 0.04]}
        scale={[width * 0.36, height * 0.18, depth * 0.24]}
        color={palette.porcelain}
        rotation={[0, 0, -0.24]}
        edgeRadius={0.016}
      />
      <ModelBox
        position={[-width * 0.06, height * 0.674, depth * 0.086]}
        scale={[width * 0.22, height * 0.085, 0.01]}
        color={palette.coolPanel}
        rotation={[0, 0, -0.24]}
        sharp
        castShadow={false}
      />
      <ModelCylinder
        position={[width * 0.08, height * 0.58, 0]}
        scale={[height * 0.14, width * 0.22, height * 0.14]}
        color={palette.steelDark}
        rotation={[0, 0, Math.PI / 2 - 0.24]}
        materialKind="aluminum"
      />
      <ModelCylinder
        position={[width * 0.17, height * 0.545, 0]}
        scale={[0.07, width * 0.24, 0.07]}
        color={glassBlue}
        opacity={0.34}
        rotation={[0, 0, Math.PI / 2 - 0.24]}
        materialKind="glass"
        castShadow={false}
      />
      <GlassFlask
        position={[width * 0.25, height * 0.43, depth * 0.035]}
        scale={[width * 0.28, height * 0.23, depth * 0.3]}
        rotation={[0, 0, -0.42]}
        neckLength={0.32}
      />
      <ModelCylinder
        position={[condenserX, height * 0.76, condenserZ]}
        scale={[width * 0.16, height * 0.36, width * 0.16]}
        color={glassBlue}
        materialKind="glass"
        opacity={0.28}
        castShadow={false}
      />
      <ModelCylinder
        position={[condenserX, height * 0.76, condenserZ]}
        scale={[width * 0.045, height * 0.43, width * 0.045]}
        color={glassBlue}
        opacity={0.44}
        materialKind="glass"
        castShadow={false}
      />
      <HelicalTube
        position={[condenserX, height * 0.76, condenserZ]}
        radius={width * 0.045}
        height={height * 0.28}
        turns={detail === "preview" ? 4.2 : 2.8}
        tubeRadius={0.006}
        color="#badbd7"
      />
      {[0.58, 0.94].map((level) => (
        <group key={level}>
          <ModelTorus
            position={[condenserX, height * level, condenserZ]}
            scale={[width * 0.16, width * 0.16, width * 0.16]}
            color={palette.steelDark}
            materialKind="aluminum"
          />
          <ModelCylinder
            position={[condenserX, height * level, condenserZ + depth * 0.1]}
            scale={[0.028, depth * 0.16, 0.028]}
            color={glassBlue}
            opacity={0.36}
            rotation={[Math.PI / 2, 0, 0]}
            materialKind="glass"
            castShadow={false}
          />
          <ModelTorus
            position={[condenserX, height * level, condenserZ + depth * 0.175]}
            scale={[0.04, 0.04, 0.04]}
            color="#b7cfcc"
            materialKind="glass"
            rotation={[0, 0, 0]}
            castShadow={false}
          />
        </group>
      ))}
      <TubeBetween
        start={[condenserX, height * 0.59, condenserZ]}
        end={[-width * 0.06, height * 0.63, -depth * 0.02]}
        radius={0.027}
        color={glassBlue}
        metalness={0.04}
        roughness={0.08}
        materialKind="glass"
        opacity={0.38}
      />
      <GlassFlask
        position={[-width * 0.18, height * 0.38, depth * 0.09]}
        scale={[width * 0.2, height * 0.18, depth * 0.22]}
        rotation={[0, 0, 0.12]}
        neckLength={0.34}
      />
      <TubeBetween
        start={[condenserX, height * 0.57, condenserZ]}
        end={[-width * 0.18, height * 0.47, depth * 0.09]}
        radius={0.022}
        color={glassBlue}
        metalness={0.02}
        roughness={0.08}
        materialKind="glass"
        opacity={0.36}
      />
      <ModelBox
        position={[-width * 0.22, height * 0.74, -depth * 0.14]}
        scale={[width * 0.2, 0.028, depth * 0.1]}
        color={palette.steelDark}
        materialKind="aluminum"
        edgeRadius={0.006}
      />
      <TubeBetween
        start={[-width * 0.3, height * 0.75, -depth * 0.12]}
        end={[condenserX, height * 0.75, condenserZ]}
        radius={0.014}
        color={palette.steel}
        metalness={0.74}
      />
      <StatusScreen
        position={[width * 0.05, height * 0.18, depth * 0.39]}
        scale={[width * 0.24, height * 0.09, 0.012]}
        accent={accent}
      />
      <ModelCylinder
        position={[-width * 0.13, height * 0.18, depth * 0.402]}
        scale={[0.036, 0.012, 0.036]}
        color={palette.graphite}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow={false}
      />
      <CurvedTube
        points={[
          [condenserX, height * 0.94, condenserZ + depth * 0.18],
          [-width * 0.42, height * 0.88, depth * 0.1],
          [-width * 0.4, height * 0.5, depth * 0.25],
        ]}
        radius={detail === "preview" ? 0.012 : 0.01}
        color="#c69c7e"
        materialKind="rubber"
      />
      <CurvedTube
        points={[
          [condenserX, height * 0.58, condenserZ + depth * 0.18],
          [-width * 0.08, height * 0.9, depth * 0.08],
          [width * 0.02, height * 0.75, depth * 0.22],
        ]}
        radius={detail === "preview" ? 0.011 : 0.009}
        color="#c5d9d6"
        materialKind="rubber"
        opacity={0.86}
      />
      <CurvedTube
        points={[
          [-width * 0.3, height * 0.58, -depth * 0.14],
          [-width * 0.34, height * 0.3, -depth * 0.28],
          [-width * 0.15, height * 0.08, -depth * 0.29],
        ]}
        radius={0.009}
        color={palette.graphite}
        materialKind="rubber"
      />
      <Feet width={width * 0.82} depth={depth * 0.7} y={0.016} />
    </>
  );
}

function VacuumColdTrapModel({ width, depth, height, accent, detail }: ModelProps) {
  const frontZ = depth * 0.415 + 0.012;
  const dewarY = height * 0.68;
  const trapGlass = "#d8ebe8";
  return (
    <>
      <ModelBox
        position={[0, height * 0.29, 0]}
        scale={[width * 0.88, height * 0.56, depth * 0.82]}
        color={palette.porcelain}
        edgeRadius={0.018}
      />
      <ModelBox
        position={[0, height * 0.56, 0]}
        scale={[width * 0.91, 0.035, depth * 0.84]}
        color={palette.steelDark}
        materialKind="aluminum"
        edgeRadius={0.008}
      />
      <ModelBox
        position={[0, height * 0.28, frontZ - 0.004]}
        scale={[width * 0.76, height * 0.42, 0.022]}
        color={palette.coolPanel}
        edgeRadius={0.01}
      />
      <StatusScreen
        position={[-width * 0.12, height * 0.41, frontZ + 0.012]}
        scale={[width * 0.34, height * 0.1, 0.014]}
        accent={accent}
      />
      <ModelCylinder
        position={[width * 0.23, height * 0.41, frontZ + 0.016]}
        scale={[0.052, 0.014, 0.052]}
        color={palette.graphite}
        rotation={[Math.PI / 2, 0, 0]}
        materialKind="rubber"
        castShadow={false}
      />
      <ModelCylinder
        position={[width * 0.23, height * 0.41, frontZ + 0.026]}
        scale={[0.032, 0.01, 0.032]}
        color={accent}
        rotation={[Math.PI / 2, 0, 0]}
        emissive={accent}
        emissiveIntensity={0.2}
        castShadow={false}
      />
      <DialGauge
        position={[width * 0.22, height * 0.29, frontZ + 0.018]}
        diameter={Math.min(width * 0.16, height * 0.085)}
        accent={palette.red}
      />
      <VentArray
        position={[-width * 0.08, height * 0.15, frontZ + 0.016]}
        width={width * 0.22}
        count={detail === "preview" ? 8 : 5}
        gap={width * 0.07}
        vertical
      />
      {[-1, 1].flatMap((side) =>
        Array.from({ length: detail === "preview" ? 7 : 4 }, (_, index) => {
          const y = height * (0.12 + index * 0.05);
          return (
            <ModelBox
              key={`${side}-${index}`}
              position={[side * width * 0.446, y, 0]}
              scale={[0.008, height * 0.022, depth * 0.38]}
              color={palette.graphite}
              sharp
              castShadow={false}
            />
          );
        }),
      )}
      <ModelCylinder
        position={[0, dewarY, 0]}
        scale={[width * 0.62, height * 0.24, width * 0.62]}
        color={palette.steel}
        materialKind="stainless"
      />
      <ModelCylinder
        position={[0, dewarY + height * 0.115, 0]}
        scale={[width * 0.68, 0.04, width * 0.68]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <ModelTorus
        position={[0, dewarY + height * 0.137, 0]}
        scale={[width * 0.67, 0.052, width * 0.67]}
        color={palette.rubber}
        materialKind="rubber"
      />
      <ModelCylinder
        position={[0, height * 0.88, 0]}
        scale={[width * 0.37, height * 0.23, width * 0.37]}
        color={trapGlass}
        opacity={0.3}
        materialKind="glass"
        castShadow={false}
      />
      <ModelCylinder
        position={[0, height * 0.88, 0]}
        scale={[width * 0.06, height * 0.22, width * 0.06]}
        color={trapGlass}
        opacity={0.44}
        materialKind="glass"
        castShadow={false}
      />
      <CurvedTube
        points={[
          [-width * 0.11, height * 0.965, 0],
          [-width * 0.11, height * 0.84, 0],
          [width * 0.08, height * 0.81, 0],
          [width * 0.1, height * 0.955, 0],
        ]}
        radius={0.012}
        color={trapGlass}
        materialKind="glass"
        opacity={0.44}
      />
      <ModelTorus
        position={[0, height * 0.985, 0]}
        scale={[width * 0.4, 0.044, width * 0.4]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      {[-0.12, 0.12].map((x, index) => (
        <group key={x}>
          <ModelCylinder
            position={[width * x, height * 0.965, 0]}
            scale={[0.044, height * 0.05, 0.044]}
            color={index ? "#a68448" : palette.steel}
            materialKind={index ? "painted" : "stainless"}
          />
          <ModelTorus
            position={[width * x, height * 0.99, 0]}
            scale={[0.055, 0.055, 0.055]}
            color={palette.graphite}
            materialKind="rubber"
          />
        </group>
      ))}
      <TubeBetween
        start={[-width * 0.35, dewarY + height * 0.1, 0]}
        end={[-width * 0.35, height * 0.96, 0]}
        radius={0.012}
        color={palette.steel}
        metalness={0.74}
      />
      <TubeBetween
        start={[width * 0.35, dewarY + height * 0.1, 0]}
        end={[width * 0.35, height * 0.96, 0]}
        radius={0.012}
        color={palette.steel}
        metalness={0.74}
      />
      <TubeBetween
        start={[-width * 0.35, height * 0.95, 0]}
        end={[width * 0.35, height * 0.95, 0]}
        radius={0.012}
        color={palette.steel}
        metalness={0.74}
      />
      <CurvedTube
        points={[
          [width * 0.12, height * 0.99, 0],
          [width * 0.46, height * 0.93, depth * 0.11],
          [width * 0.42, height * 0.66, depth * 0.32],
        ]}
        radius={0.019}
        color="#72503b"
        materialKind="rubber"
      />
      <CurvedTube
        points={[
          [-width * 0.12, height * 0.99, 0],
          [-width * 0.47, height * 0.94, -depth * 0.1],
          [-width * 0.4, height * 0.58, -depth * 0.29],
        ]}
        radius={0.017}
        color="#72503b"
        materialKind="rubber"
      />
      <CurvedTube
        points={[
          [width * 0.34, height * 0.12, -depth * 0.38],
          [width * 0.46, height * 0.08, -depth * 0.47],
          [width * 0.35, 0.025, -depth * 0.5],
        ]}
        radius={0.009}
        color={palette.graphite}
        materialKind="rubber"
      />
      <ModelBox
        position={[-width * 0.3, height * 0.31, frontZ + 0.017]}
        scale={[width * 0.08, height * 0.16, 0.008]}
        color="#d4c6a4"
        roughness={0.72}
        sharp
        castShadow={false}
      />
      <Feet width={width} depth={depth} y={0.02} />
    </>
  );
}

function WireBasketTrolleyModel({ width, depth, height, accent, detail }: ModelProps) {
  const rail = Math.min(0.022, width * 0.021);
  const wire = detail === "preview" ? 0.006 : 0.007;
  const basketBottom = height * 0.27;
  const basketTop = height * 0.76;
  const longWireCount = detail === "preview" ? 9 : 6;
  const shortWireCount = detail === "preview" ? 5 : 4;
  const horizontalCount = detail === "preview" ? 6 : 4;
  return (
    <>
      <ModelBox
        position={[0, height * 0.19, 0]}
        scale={[width * 0.88, height * 0.09, depth * 0.72]}
        color="#324968"
        materialKind="painted"
        edgeRadius={0.012}
      />
      <ModelBox
        position={[0, height * 0.24, 0]}
        scale={[width * 0.9, 0.028, depth * 0.75]}
        color={palette.steelDark}
        materialKind="aluminum"
        edgeRadius={0.005}
      />
      {[-0.45, 0.45].flatMap((x) =>
        [-0.38, 0.38].map((z) => (
          <TubeBetween
            key={`post-${x}-${z}`}
            start={[width * x, height * 0.17, depth * z]}
            end={[width * x, basketTop + rail, depth * z]}
            radius={rail}
            color={palette.steel}
            metalness={0.78}
          />
        )),
      )}
      {[basketBottom, basketTop].map((level) => (
        <group key={level}>
          {[-0.38, 0.38].map((z) => (
            <TubeBetween
              key={`rim-long-${level}-${z}`}
              start={[-width * 0.45, level, depth * z]}
              end={[width * 0.45, level, depth * z]}
              radius={rail * (level === basketTop ? 1.18 : 0.8)}
              color={palette.steel}
              metalness={0.8}
            />
          ))}
          {[-0.45, 0.45].map((x) => (
            <TubeBetween
              key={`rim-short-${level}-${x}`}
              start={[width * x, level, -depth * 0.38]}
              end={[width * x, level, depth * 0.38]}
              radius={rail * (level === basketTop ? 1.18 : 0.8)}
              color={palette.steel}
              metalness={0.8}
            />
          ))}
        </group>
      ))}
      {[-0.38, 0.38].flatMap((z) =>
        Array.from({ length: longWireCount }, (_, index) => {
          const x = -0.4 + (index / (longWireCount - 1)) * 0.8;
          return (
            <TubeBetween
              key={`long-wall-vertical-${z}-${index}`}
              start={[width * x, basketBottom, depth * z]}
              end={[width * x, basketTop, depth * z]}
              radius={wire}
              color={palette.steel}
              metalness={0.76}
            />
          );
        }),
      )}
      {[-0.45, 0.45].flatMap((x) =>
        Array.from({ length: shortWireCount }, (_, index) => {
          const z = -0.32 + (index / (shortWireCount - 1)) * 0.64;
          return (
            <TubeBetween
              key={`short-wall-vertical-${x}-${index}`}
              start={[width * x, basketBottom, depth * z]}
              end={[width * x, basketTop, depth * z]}
              radius={wire}
              color={palette.steel}
              metalness={0.76}
            />
          );
        }),
      )}
      {Array.from({ length: horizontalCount }, (_, index) => {
        const progress = (index + 1) / (horizontalCount + 1);
        const y = basketBottom + (basketTop - basketBottom) * progress;
        return (
          <group key={`wall-horizontal-${index}`}>
            {[-0.38, 0.38].map((z) => (
              <TubeBetween
                key={`long-${z}`}
                start={[-width * 0.45, y, depth * z]}
                end={[width * 0.45, y, depth * z]}
                radius={wire}
                color={palette.steel}
                metalness={0.76}
              />
            ))}
            {[-0.45, 0.45].map((x) => (
              <TubeBetween
                key={`short-${x}`}
                start={[width * x, y, -depth * 0.38]}
                end={[width * x, y, depth * 0.38]}
                radius={wire}
                color={palette.steel}
                metalness={0.76}
              />
            ))}
          </group>
        );
      })}
      {Array.from({ length: detail === "preview" ? 8 : 5 }, (_, index) => {
        const x = -0.4 + (index / (detail === "preview" ? 7 : 4)) * 0.8;
        return (
          <TubeBetween
            key={`floor-long-${index}`}
            start={[width * x, basketBottom, -depth * 0.38]}
            end={[width * x, basketBottom, depth * 0.38]}
            radius={wire}
            color={palette.steel}
            metalness={0.76}
          />
        );
      })}
      {Array.from({ length: detail === "preview" ? 6 : 4 }, (_, index) => {
        const z = -0.33 + (index / (detail === "preview" ? 5 : 3)) * 0.66;
        return (
          <TubeBetween
            key={`floor-short-${index}`}
            start={[-width * 0.45, basketBottom, depth * z]}
            end={[width * 0.45, basketBottom, depth * z]}
            radius={wire}
            color={palette.steel}
            metalness={0.76}
          />
        );
      })}
      <ModelBox
        position={[0, height * 0.52, depth * 0.388]}
        scale={[width * 0.17, height * 0.09, 0.01]}
        color="#e4e7df"
        materialKind="powder"
        sharp
        castShadow={false}
      />
      <ModelBox
        position={[0, height * 0.52, depth * 0.396]}
        scale={[width * 0.11, 0.012, 0.004]}
        color="#436b80"
        sharp
        castShadow={false}
      />
      {[-0.4, 0.4].map((x) => (
        <TubeBetween
          key={`handle-upright-${x}`}
          start={[width * x, height * 0.2, -depth * 0.42]}
          end={[width * x, height * 0.91, -depth * 0.42]}
          radius={rail * 1.02}
          color={palette.steelDark}
          metalness={0.72}
        />
      ))}
      <TubeBetween
        start={[-width * 0.41, height * 0.91, -depth * 0.42]}
        end={[width * 0.41, height * 0.91, -depth * 0.42]}
        radius={rail * 1.25}
        color={accent}
      />
      {[-0.4, 0.4].flatMap((x) =>
        [-0.31, 0.31].map((z) => (
          <TrolleyCaster
            key={`caster-${x}-${z}`}
            position={[width * x, 0, depth * z]}
            size={Math.min(0.1, height * 0.095)}
          />
        )),
      )}
    </>
  );
}

function BottleCartModel({ width, depth, height, accent, detail }: ModelProps) {
  return (
    <>
      {[0.18, 0.48, 0.78].map((level) => (
        <group key={level}>
          <ModelBox
            position={[0, height * level, 0]}
            scale={[width * 0.9, 0.06, depth * 0.84]}
            color={palette.graphite}
            edgeRadius={0.012}
          />
          <ModelBox
            position={[0, height * (level + 0.055), depth * 0.4]}
            scale={[width * 0.88, 0.07, 0.025]}
            color={accent}
            edgeRadius={0.005}
          />
        </group>
      ))}
      {[-0.42, 0.42].flatMap((x) =>
        [-0.36, 0.36].map((z) => (
          <TubeBetween
            key={`cart-post-${x}-${z}`}
            start={[width * x, 0.08, depth * z]}
            end={[width * x, height * 0.88, depth * z]}
            radius={0.025}
            color={palette.graphite}
          />
        )),
      )}
      {detail === "preview" &&
        [-0.26, 0, 0.26].flatMap((x) =>
          [0.25, 0.55, 0.85].map((level) => (
            <ModelCylinder
              key={`bottle-${x}-${level}`}
              position={[width * x, height * level, 0]}
              scale={[width * 0.12, height * 0.14, width * 0.12]}
              color={x === 0 ? "#382c26" : "#536b5c"}
              opacity={0.92}
            />
          )),
        )}
      {[-0.4, 0.4].flatMap((x) =>
        [-0.34, 0.34].map((z) => (
          <CasterAssembly key={`${x}-${z}`} position={[width * x, 0, depth * z]} size={0.065} />
        )),
      )}
    </>
  );
}

function BasketTowerModel({ width, depth, height }: ModelProps) {
  const colors = ["#90b52d", "#d7592e", "#88b832", "#e2652e", "#8cb52b"];
  return (
    <>
      {[-0.43, 0.43].flatMap((x) =>
        [-0.37, 0.37].map((z) => (
          <TubeBetween
            key={`${x}-${z}`}
            start={[width * x, 0, depth * z]}
            end={[width * x, height, depth * z]}
            radius={0.025}
            color={palette.graphite}
          />
        )),
      )}
      {colors.map((color, index) => {
        const y = height * (0.16 + index * 0.18);
        return (
          <group key={color} rotation={[-0.12, 0, 0]}>
            <ModelBox
              position={[0, y, depth * 0.02]}
              scale={[width * 0.86, height * 0.12, depth * 0.78]}
              color={color}
              edgeRadius={0.018}
            />
            <ModelBox
              position={[0, y + height * 0.065, depth * 0.4]}
              scale={[width * 0.82, 0.04, 0.03]}
              color={color}
              edgeRadius={0.008}
            />
          </group>
        );
      })}
    </>
  );
}

function HeatingBathModel({ width, depth, height, accent, detail }: ModelProps) {
  const frontZ = depth / 2 + 0.02;
  return (
    <>
      <ModelBox
        position={[0, height * 0.45, 0]}
        scale={[width, height * 0.9, depth]}
        color="#3d9a9c"
        edgeRadius={0.018}
      />
      <ModelBox
        position={[0, height * 0.88, 0]}
        scale={[width * 0.9, 0.05, depth * 0.76]}
        color={palette.steel}
        materialKind="stainless"
        edgeRadius={0.006}
      />
      <ModelBox
        position={[0, height * 0.91, 0]}
        scale={[width * 0.78, 0.025, depth * 0.61]}
        color={palette.graphite}
        materialKind="rubber"
        edgeRadius={0.004}
      />
      {Array.from({ length: 6 }, (_, index) => {
        const x = width * (-0.36 + index * 0.145);
        return (
          <group key={index}>
            <ModelCylinder
              position={[x, height * 0.38, frontZ]}
              scale={[0.055, 0.026, 0.055]}
              color={palette.graphite}
              rotation={[Math.PI / 2, 0, 0]}
              materialKind="rubber"
            />
            {detail === "preview" && (
              <ModelCylinder
                position={[x, height * 0.59, frontZ]}
                scale={[0.018, 0.012, 0.018]}
                color={index % 2 ? accent : palette.red}
                rotation={[Math.PI / 2, 0, 0]}
                emissive={index % 2 ? accent : palette.red}
                emissiveIntensity={0.32}
                castShadow={false}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

function ProcessVesselModel({ width, depth, height, accent }: ModelProps) {
  const diameter = Math.min(width, depth) * 0.78;
  return (
    <>
      <ModelCylinder
        position={[0, height * 0.48, 0]}
        scale={[diameter, height * 0.72, diameter]}
        color={palette.steel}
        materialKind="stainless"
      />
      <ModelSphere
        position={[0, height * 0.82, 0]}
        scale={[diameter, height * 0.18, diameter]}
        color={palette.steel}
        materialKind="stainless"
      />
      <ModelCylinder
        position={[0, height * 0.9, 0]}
        scale={[diameter * 1.02, 0.05, diameter * 1.02]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <ModelTorus
        position={[0, height * 0.92, 0]}
        scale={[diameter * 0.94, 0.035, diameter * 0.94]}
        color={palette.graphite}
        materialKind="rubber"
      />
      {[-1, 1].map((side) => (
        <TubeBetween
          key={side}
          start={[side * diameter * 0.48, height * 0.58, 0]}
          end={[side * diameter * 0.62, height * 0.58, 0]}
          radius={0.022}
          color={palette.steelDark}
          metalness={0.68}
        />
      ))}
      <TubeBetween
        start={[0, height * 0.25, depth * 0.34]}
        end={[0, height * 0.12, depth * 0.46]}
        radius={0.025}
        color={palette.steelDark}
        metalness={0.7}
      />
      <ModelBox
        position={[0, height * 0.11, depth * 0.47]}
        scale={[width * 0.22, 0.04, 0.04]}
        color={accent}
      />
    </>
  );
}

function RetortStandModel({ width, depth, height, accent, detail }: ModelProps) {
  return (
    <>
      <ModelBox
        position={[0, 0.04, 0]}
        scale={[width * 0.82, 0.08, depth * 0.72]}
        color={palette.graphite}
        edgeRadius={0.008}
      />
      <ModelCylinder
        position={[0, height * 0.5, -depth * 0.18]}
        scale={[0.04, height * 0.92, 0.04]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <TubeBetween
        start={[-width * 0.36, height * 0.72, -depth * 0.18]}
        end={[width * 0.36, height * 0.72, -depth * 0.18]}
        radius={0.022}
        color={palette.steelDark}
        metalness={0.68}
      />
      <ModelCylinder
        position={[width * 0.2, height * 0.68, 0]}
        scale={[width * 0.16, height * 0.38, width * 0.16]}
        color={palette.glass}
        materialKind="glass"
        opacity={0.3}
        castShadow={false}
      />
      <ModelSphere
        position={[width * 0.2, height * 0.37, depth * 0.03]}
        scale={[width * 0.27, height * 0.17, depth * 0.27]}
        color={palette.glass}
        materialKind="glass"
        opacity={0.32}
        castShadow={false}
      />
      <ModelBox
        position={[width * 0.2, height * 0.72, -depth * 0.17]}
        scale={[width * 0.22, 0.055, 0.055]}
        color={accent}
      />
      {detail === "preview" && (
        <CurvedTube
          points={[
            [width * 0.28, height * 0.84, 0],
            [width * 0.42, height * 0.78, depth * 0.1],
            [width * 0.34, height * 0.4, depth * 0.3],
          ]}
          radius={0.012}
          color="#d6c0a6"
          materialKind="rubber"
        />
      )}
    </>
  );
}

function OvenModel({ width, depth, height, accent, detail }: ModelProps) {
  const frontZ = depth / 2 + 0.02;
  return (
    <>
      <ModelBox
        position={[0, height / 2, 0]}
        scale={[width, height, depth]}
        color={palette.coolPanel}
        edgeRadius={0.018}
      />
      <ModelBox
        position={[-width * 0.08, height * 0.46, frontZ - 0.004]}
        scale={[width * 0.7, height * 0.62, 0.035]}
        color={palette.graphite}
        materialKind="rubber"
        edgeRadius={0.008}
      />
      <ModelBox
        position={[-width * 0.08, height * 0.46, frontZ + 0.016]}
        scale={[width * 0.58, height * 0.5, 0.018]}
        color={palette.glass}
        materialKind="glass"
        opacity={0.28}
        edgeRadius={0.004}
        castShadow={false}
      />
      <ModelBox
        position={[-width * 0.08, height * 0.76, frontZ + 0.045]}
        scale={[width * 0.54, 0.035, 0.035]}
        color={palette.steelDark}
        materialKind="aluminum"
      />
      <StatusScreen
        position={[width * 0.36, height * 0.73, frontZ + 0.028]}
        scale={[width * 0.16, height * 0.14, 0.012]}
        accent={accent}
      />
      <VentArray
        position={[width * 0.36, height * 0.28, frontZ + 0.025]}
        width={width * 0.14}
        count={detail === "preview" ? 6 : 3}
        gap={height * 0.09}
      />
      <Feet width={width} depth={depth} y={0.018} />
    </>
  );
}

function GasCylinderModel({ width, depth, height, accent }: ModelProps) {
  const diameter = Math.min(width, depth);
  return (
    <>
      <ModelCylinder
        position={[0, height * 0.45, 0]}
        scale={[diameter * 0.82, height * 0.78, diameter * 0.82]}
        color={accent}
        metalness={0.34}
      />
      <ModelSphere
        position={[0, height * 0.82, 0]}
        scale={[diameter * 0.82, height * 0.2, diameter * 0.82]}
        color={accent}
        metalness={0.34}
      />
      <ModelCylinder
        position={[0, height * 0.93, 0]}
        scale={[diameter * 0.28, height * 0.12, diameter * 0.28]}
        color={palette.steelDark}
        metalness={0.55}
      />
      <ModelTorus
        position={[0, height * 0.94, 0]}
        scale={[diameter * 0.48, 0.05, diameter * 0.48]}
        color={palette.graphite}
      />
      <ModelBox
        position={[diameter * 0.17, height * 0.98, 0]}
        scale={[diameter * 0.24, 0.035, 0.05]}
        color={palette.graphite}
      />
    </>
  );
}

function SafetyModel({ id, width, depth, height, accent }: ModelProps & { id: string }) {
  if (id === "fire-extinguisher") {
    return (
      <>
        <ModelCylinder
          position={[0, height * 0.43, 0]}
          scale={[width * 0.76, height * 0.72, depth * 0.76]}
          color={palette.red}
        />
        <ModelSphere
          position={[0, height * 0.76, 0]}
          scale={[width * 0.76, height * 0.18, depth * 0.76]}
          color={palette.red}
        />
        <ModelBox
          position={[0, height * 0.91, 0]}
          scale={[width * 0.55, 0.055, depth * 0.24]}
          color={palette.graphite}
        />
        <TubeBetween
          start={[width * 0.25, height * 0.88, 0]}
          end={[width * 0.42, height * 0.52, depth * 0.28]}
          radius={0.012}
          color={palette.graphite}
        />
      </>
    );
  }
  if (id === "safety-shower") {
    return (
      <>
        <TubeBetween
          start={[0, 0, 0]}
          end={[0, height * 0.94, 0]}
          radius={0.025}
          color={palette.steel}
        />
        <TubeBetween
          start={[0, height * 0.94, 0]}
          end={[width * 0.25, height * 0.94, 0]}
          radius={0.025}
          color={palette.steel}
        />
        <ModelCone
          position={[width * 0.25, height * 0.88, 0]}
          scale={[width * 0.28, 0.12, depth * 0.28]}
          color={accent}
          rotation={[Math.PI, 0, 0]}
        />
        <TubeBetween
          start={[width * 0.1, height * 0.72, 0]}
          end={[width * 0.1, height * 0.35, 0]}
          radius={0.012}
          color={palette.red}
        />
        <ModelBox
          position={[width * 0.1, height * 0.32, 0]}
          scale={[0.08, 0.035, 0.03]}
          color={palette.red}
        />
      </>
    );
  }
  return (
    <>
      <TubeBetween
        start={[0, 0, -depth * 0.18]}
        end={[0, height * 0.72, -depth * 0.18]}
        radius={0.025}
        color={palette.steel}
      />
      <ModelCylinder
        position={[0, height * 0.72, 0]}
        scale={[width * 0.78, 0.08, depth * 0.72]}
        color={palette.steel}
        metalness={0.48}
      />
      {[-0.2, 0.2].map((x) => (
        <group key={x}>
          <ModelCylinder
            position={[width * x, height * 0.77, 0]}
            scale={[0.075, 0.06, 0.075]}
            color={accent}
          />
          <ModelCone
            position={[width * x, height * 0.83, 0]}
            scale={[0.06, 0.05, 0.06]}
            color={palette.steelDark}
          />
        </group>
      ))}
      <ModelBox
        position={[0, height * 0.4, depth * 0.02]}
        scale={[width * 0.4, 0.12, 0.04]}
        color={accent}
      />
    </>
  );
}

function WasteModel({ id, width, depth, height, accent }: ModelProps & { id: string }) {
  return (
    <>
      <ModelBox
        position={[0, height * 0.46, 0]}
        scale={[width * 0.9, height * 0.82, depth * 0.9]}
        color={id === "biological-waste-bin" ? accent : palette.graphite}
      />
      <ModelBox
        position={[0, height * 0.9, 0]}
        scale={[width, height * 0.12, depth]}
        color={id === "biological-waste-bin" ? palette.yellow : palette.rubber}
        rotation={[-0.05, 0, 0]}
      />
      <ModelBox
        position={[0, height * 0.08, depth * 0.48]}
        scale={[width * 0.28, 0.05, 0.06]}
        color={palette.steelDark}
      />
    </>
  );
}

function OpeningAssetModel({
  id,
  objectType,
  width,
  depth,
  height,
  detail,
}: ModelProps & { id: string; objectType: "door" | "window" }) {
  const frameDepth = Math.max(0.07, Math.min(depth, objectType === "window" ? 0.18 : 0.14));
  const rail = Math.max(0.045, Math.min(0.09, Math.min(width, height) * 0.055));
  const clearWidth = Math.max(0.08, width - rail * 2);
  const clearHeight = Math.max(0.08, height - rail * 2);
  const frameColor = palette.steel;
  const front = frameDepth / 2 + 0.008;

  const frame = (
    <>
      {[-1, 1].map((side) => (
        <ModelBox
          key={`jamb-${side}`}
          position={[side * (width / 2 - rail / 2), height / 2, 0]}
          scale={[rail, height, frameDepth]}
          color={frameColor}
          materialKind="aluminum"
          sharp
        />
      ))}
      {[-1, 1].map((edge) => (
        <ModelBox
          key={`rail-${edge}`}
          position={[0, edge < 0 ? rail / 2 : height - rail / 2, 0]}
          scale={[clearWidth, rail, frameDepth]}
          color={frameColor}
          materialKind="aluminum"
          sharp
        />
      ))}
      <ModelBox
        position={[0, rail * 0.22, front]}
        scale={[clearWidth, rail * 0.16, frameDepth * 0.18]}
        color={palette.rubber}
        materialKind="rubber"
        sharp
      />
    </>
  );

  if (objectType === "window") {
    const passThrough = id === "pass-through-window";
    const sliding = id === "sliding-window" || passThrough;
    const paneCount = id === "wide-window" ? 3 : id === "standard-window" ? 1 : 2;
    const mullion = Math.max(0.028, rail * 0.62);
    const paneWidth = (clearWidth - mullion * (paneCount - 1)) / paneCount;
    return (
      <>
        {frame}
        {passThrough && (
          <>
            <ModelBox
              position={[0, clearHeight / 2 + rail, 0]}
              scale={[clearWidth, clearHeight, Math.max(frameDepth, depth * 0.88)]}
              color={palette.steel}
              opacity={0.24}
              materialKind="stainless"
              sharp
            />
            <ModelBox
              position={[0, rail * 0.72, depth * 0.18]}
              scale={[width + rail * 0.8, rail * 0.42, depth]}
              color={palette.steel}
              materialKind="stainless"
              sharp
            />
          </>
        )}
        {Array.from({ length: paneCount }, (_, index) => {
          const x = -clearWidth / 2 + paneWidth / 2 + index * (paneWidth + mullion);
          const z = sliding ? (index % 2 === 0 ? -0.018 : 0.018) : 0;
          return (
            <ModelBox
              key={`pane-${index}`}
              position={[x, height / 2, z]}
              scale={[paneWidth, clearHeight, 0.022]}
              color={palette.glass}
              opacity={0.38}
              materialKind="glass"
              sharp
            />
          );
        })}
        {Array.from({ length: paneCount - 1 }, (_, index) => (
          <ModelBox
            key={`mullion-${index}`}
            position={[
              -clearWidth / 2 + (index + 1) * paneWidth + index * mullion + mullion / 2,
              height / 2,
              0,
            ]}
            scale={[mullion, clearHeight, frameDepth * 0.82]}
            color={frameColor}
            materialKind="aluminum"
            sharp
          />
        ))}
        {sliding && (
          <>
            <ModelBox
              position={[0, rail * 1.12, front]}
              scale={[clearWidth, rail * 0.13, frameDepth * 0.28]}
              color={palette.steel}
              materialKind="aluminum"
              sharp
            />
            <ModelBox
              position={[mullion * 1.2, height * 0.52, front + 0.012]}
              scale={[mullion * 0.42, height * 0.12, 0.018]}
              color={palette.graphite}
              materialKind="rubber"
              sharp
            />
          </>
        )}
        {detail === "preview" && (
          <ModelBox
            position={[0, height - rail * 0.28, front]}
            scale={[clearWidth * 0.82, rail * 0.08, 0.006]}
            color="#eef8f6"
            opacity={0.7}
            sharp
          />
        )}
      </>
    );
  }

  const doubleLeaf = isDoubleLeafDoor(id);
  const sliding = id.includes("sliding-door");
  const largeGlazing = id === "cleanroom-glazed-door" || sliding;
  const narrowLite = id === "narrow-lite-door";
  const leafCount = doubleLeaf ? 2 : 1;
  const leafGap = Math.max(0.01, rail * 0.12);
  const leafWidth = (clearWidth - leafGap * (leafCount - 1)) / leafCount;

  return (
    <>
      {frame}
      {sliding && (
        <ModelBox
          position={[0, height + rail * 0.26, -frameDepth * 0.06]}
          scale={[width + rail * 0.9, rail * 0.52, frameDepth * 1.3]}
          color={palette.steelDark}
          materialKind="aluminum"
          sharp
        />
      )}
      {Array.from({ length: leafCount }, (_, index) => {
        const x = -clearWidth / 2 + leafWidth / 2 + index * (leafWidth + leafGap);
        const z = sliding ? (index % 2 === 0 ? -0.018 : 0.018) : 0;
        const glassWidth = largeGlazing
          ? leafWidth * 0.72
          : narrowLite
            ? leafWidth * 0.2
            : doubleLeaf
              ? leafWidth * 0.48
              : 0;
        const glassHeight = largeGlazing ? clearHeight * 0.68 : clearHeight * 0.38;
        const handleSide = doubleLeaf ? (index === 0 ? 1 : -1) : 1;
        return (
          <group key={`leaf-${index}`}>
            <ModelBox
              position={[x, height / 2, z]}
              scale={[leafWidth, clearHeight, Math.max(0.035, frameDepth * 0.52)]}
              color={id === "narrow-lite-door" ? palette.powderWhite : palette.coolPanel}
              materialKind="powder"
              sharp
            />
            {glassWidth > 0 && (
              <>
                <ModelBox
                  position={[x, height * (largeGlazing ? 0.59 : 0.64), front]}
                  scale={[glassWidth + rail * 0.3, glassHeight + rail * 0.3, 0.026]}
                  color={palette.steelDark}
                  materialKind="aluminum"
                  sharp
                />
                <ModelBox
                  position={[x, height * (largeGlazing ? 0.59 : 0.64), front + 0.012]}
                  scale={[glassWidth, glassHeight, 0.018]}
                  color={palette.glass}
                  opacity={0.34}
                  materialKind="glass"
                  sharp
                />
              </>
            )}
            <ModelBox
              position={[x, height * 0.09, front + 0.014]}
              scale={[leafWidth * 0.82, height * 0.13, 0.018]}
              color={palette.steel}
              materialKind="stainless"
              sharp
            />
            <ModelBox
              position={[x + handleSide * leafWidth * 0.34, height * 0.5, front + 0.035]}
              scale={[0.022, height * 0.13, 0.026]}
              color={palette.steel}
              materialKind="stainless"
              sharp
            />
          </group>
        );
      })}
      {!sliding && (
        <ModelBox
          position={[doubleLeaf ? -clearWidth * 0.26 : 0, height - rail * 1.2, front + 0.02]}
          scale={[Math.min(clearWidth * 0.42, 0.42), rail * 0.18, 0.026]}
          color={palette.steelDark}
          materialKind="aluminum"
          sharp
        />
      )}
      {sliding && (
        <ModelBox
          position={[0, rail * 0.72, front]}
          scale={[clearWidth, rail * 0.16, frameDepth * 0.28]}
          color={palette.steel}
          materialKind="aluminum"
          sharp
        />
      )}
    </>
  );
}

function GenericInstrumentModel({ width, depth, height, accent, detail }: ModelProps) {
  const frontZ = depth / 2 + 0.016;
  return (
    <>
      <ModelBox
        position={[0, height / 2, 0]}
        scale={[width, height, depth]}
        color={palette.powderWhite}
      />
      <ModelBox
        position={[0, height * 0.78, -depth * 0.08]}
        scale={[width * 0.82, height * 0.14, depth * 0.72]}
        color={palette.coolPanel}
        rotation={[-0.08, 0, 0]}
      />
      <StatusScreen
        position={[-width * 0.18, height * 0.48, frontZ + 0.02]}
        scale={[width * 0.3, Math.max(0.05, height * 0.14), 0.014]}
        accent={accent}
      />
      {detail === "preview" &&
        [0.08, 0.18, 0.28].map((x) => (
          <ModelCylinder
            key={x}
            position={[width * x, height * 0.48, frontZ + 0.025]}
            scale={[0.025, 0.014, 0.025]}
            color={x === 0.28 ? accent : palette.steelDark}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow={false}
          />
        ))}
      <Feet width={width} depth={depth} y={0.018} />
    </>
  );
}

type ModelProps = {
  width: number;
  depth: number;
  height: number;
  accent: string;
  detail: DetailLevel;
};

export function ProceduralAssetModel({
  definition,
  width,
  depth,
  height,
  detail = "room",
}: {
  definition: AssetDefinition;
  width: number;
  depth: number;
  height: number;
  detail?: DetailLevel;
}) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let active = true;
    void waitForLaboratoryMaterialTextures().then(() => {
      if (active) invalidate();
    });
    return () => {
      active = false;
    };
  }, [invalidate]);

  const props = { width, depth, height, accent: definition.accent, detail };
  const id = definition.id;
  let model: ReactNode;

  if (definition.objectType === "door" || definition.objectType === "window") {
    model = <OpeningAssetModel {...props} id={id} objectType={definition.objectType} />;
  } else if (id === "rotary-evaporator") {
    model = <RotaryEvaporatorModel {...props} />;
  } else if (id === "vacuum-cold-trap-system") {
    model = <VacuumColdTrapModel {...props} />;
  } else if (id === "wire-basket-trolley") {
    model = <WireBasketTrolleyModel {...props} />;
  } else if (id === "rolling-bottle-cart") {
    model = <BottleCartModel {...props} />;
  } else if (id === "plastic-basket-tower") {
    model = <BasketTowerModel {...props} />;
  } else if (id === "multi-position-heating-bath") {
    model = <HeatingBathModel {...props} />;
  } else if (id === "stainless-process-vessel") {
    model = <ProcessVesselModel {...props} />;
  } else if (id === "retort-stand-assembly") {
    model = <RetortStandModel {...props} />;
  } else if (id === "forced-air-lab-oven") {
    model = <OvenModel {...props} />;
  } else if (["bench", "corner"].includes(definition.profile)) {
    model = <BenchModel {...props} id={id} />;
  } else if (["table", "workstation"].includes(definition.profile)) {
    model = <TableModel {...props} id={id} />;
  } else if (definition.profile === "seat") {
    model = <SeatModel {...props} id={id} />;
  } else if (["cabinet", "tall", "locker"].includes(definition.profile)) {
    model = <CabinetModel {...props} id={id} />;
  } else if (["shelf", "rack"].includes(definition.profile)) {
    model = <ShelfModel {...props} id={id} />;
  } else if (definition.profile === "hood") {
    model = <HoodModel {...props} id={id} />;
  } else if (["benchtop-centrifuge", "floor-centrifuge", "microcentrifuge"].includes(id)) {
    model = <CentrifugeModel {...props} id={id} />;
  } else if (definition.profile === "scope") {
    model = <MicroscopeModel {...props} id={id} />;
  } else if (["analytical-balance", "top-loading-balance"].includes(id)) {
    model = <BalanceModel {...props} id={id} />;
  } else if (
    [
      "incubator",
      "shaking-incubator",
      "lab-refrigerator",
      "lab-freezer",
      "ultra-low-freezer",
      "ice-maker",
    ].includes(id)
  ) {
    model = <ThermalCabinetModel {...props} id={id} />;
  } else if (id === "autoclave") {
    model = <AutoclaveModel {...props} />;
  } else if (definition.profile === "washer") {
    model = <WasherModel {...props} />;
  } else if (id === "vacuum-pump") {
    model = <VacuumPumpModel {...props} />;
  } else if (id === "gas-cylinder") {
    model = <GasCylinderModel {...props} />;
  } else if (["eyewash", "safety-shower", "fire-extinguisher"].includes(id)) {
    model = <SafetyModel {...props} id={id} />;
  } else if (["waste-bin", "biological-waste-bin"].includes(id)) {
    model = <WasteModel {...props} id={id} />;
  } else if (
    [
      "pcr-machine",
      "real-time-pcr",
      "spectrophotometer",
      "plate-reader",
      "electrophoresis-tank",
      "gel-doc",
      "hotplate-stirrer",
      "water-bath",
      "dry-block-heater",
      "printer",
    ].includes(id)
  ) {
    model = <BenchInstrumentModel {...props} id={id} />;
  } else if (definition.profile === "column") {
    model = (
      <ModelBox
        position={[0, height / 2, 0]}
        scale={[width, height, depth]}
        color={palette.coolPanel}
      />
    );
  } else {
    model = <GenericInstrumentModel {...props} />;
  }

  return <>{model}</>;
}

export function SelectionBounds({
  width,
  depth,
  height,
  precision = false,
}: {
  width: number;
  depth: number;
  height: number;
  precision?: boolean;
}) {
  if (precision) {
    const precisionScale: Vector3Tuple = [width + 0.045, height + 0.045, depth + 0.045];
    return (
      <lineSegments
        position={[0, height / 2, 0]}
        scale={precisionScale}
        geometry={UNIT_BOX_EDGES}
        renderOrder={20}
      >
        <lineBasicMaterial
          color="#22e2c7"
          transparent
          opacity={0.96}
          depthTest
          depthWrite={false}
        />
      </lineSegments>
    );
  }

  const haloScale: Vector3Tuple = [width + 0.15, height + 0.15, depth + 0.15];
  const traceScale: Vector3Tuple = [width + 0.055, height + 0.055, depth + 0.055];
  return (
    <group position={[0, height / 2, 0]}>
      <mesh scale={[width + 0.035, height + 0.035, depth + 0.035]} renderOrder={18}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#28e0c6"
          transparent
          opacity={0.045}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments scale={haloScale} geometry={UNIT_BOX_EDGES} renderOrder={19}>
        <lineBasicMaterial color="#7fffea" transparent opacity={0.28} depthTest={false} />
      </lineSegments>
      <lineSegments scale={traceScale} geometry={UNIT_BOX_EDGES} renderOrder={20}>
        <lineBasicMaterial color="#14d7bc" transparent opacity={1} depthTest={false} />
      </lineSegments>
    </group>
  );
}
