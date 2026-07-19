import { useMemo } from "react";
import * as THREE from "three";
import type { Room } from "../domain/schema";
import {
  getLaboratoryEnvironmentProfile,
  type EnvironmentBottle,
  type EnvironmentConsumableBox,
  type EnvironmentDocumentBoard,
  type EnvironmentGlassware,
  type EnvironmentMember,
  type EnvironmentMonitor,
  type EnvironmentPipetteRack,
  type EnvironmentPoint,
  type EnvironmentTray,
  type EnvironmentTubingRun,
  type LaboratoryEnvironmentProfile,
} from "../domain/laboratory-environment";

type MeshTransform = {
  position?: EnvironmentPoint;
  rotation?: EnvironmentPoint;
  scale?: EnvironmentPoint;
};

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const UNIT_SPHERE = new THREE.SphereGeometry(0.5, 12, 8);
const UNIT_TORUS = new THREE.TorusGeometry(0.5, 0.07, 8, 24);
const OPEN_CYLINDER = new THREE.CylinderGeometry(0.5, 0.46, 1, 24, 1, true);
const REAGENT_BOTTLE_BODY = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.4, -0.5),
    new THREE.Vector2(0.47, -0.47),
    new THREE.Vector2(0.5, -0.38),
    new THREE.Vector2(0.5, 0.2),
    new THREE.Vector2(0.45, 0.3),
    new THREE.Vector2(0.29, 0.42),
    new THREE.Vector2(0.25, 0.5),
  ],
  24,
);
const GLASS_FLASK = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.04, -0.5),
    new THREE.Vector2(0.32, -0.46),
    new THREE.Vector2(0.47, -0.24),
    new THREE.Vector2(0.42, 0.12),
    new THREE.Vector2(0.2, 0.34),
    new THREE.Vector2(0.13, 0.4),
    new THREE.Vector2(0.13, 0.5),
  ],
  28,
);

class CoiledDropCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 2 * 13;
    return target.set(Math.cos(angle) * 0.037, -t * 0.72, Math.sin(angle) * 0.037);
  }
}

const COILED_DROP = new THREE.TubeGeometry(new CoiledDropCurve(), 132, 0.009, 6, false);

function physicalMaterial(
  color: string,
  options: ConstructorParameters<typeof THREE.MeshPhysicalMaterial>[0] = {},
) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.48,
    metalness: 0.04,
    envMapIntensity: 0.78,
    ...options,
  });
}

const materials = {
  ceilingWhite: physicalMaterial("#e4e9e6", { roughness: 0.58, clearcoat: 0.08 }),
  light: physicalMaterial("#f4ffff", {
    emissive: new THREE.Color("#e8ffff"),
    emissiveIntensity: 2.8,
    roughness: 0.2,
    toneMapped: false,
  }),
  aluminum: physicalMaterial("#9aa7a4", {
    metalness: 0.72,
    roughness: 0.3,
    anisotropy: 0.5,
  }),
  duct: physicalMaterial("#b9c2bf", {
    metalness: 0.82,
    roughness: 0.25,
    anisotropy: 0.68,
  }),
  ventDark: physicalMaterial("#4b5654", { metalness: 0.36, roughness: 0.5 }),
  cable: physicalMaterial("#eef1ed", { roughness: 0.64 }),
  plug: physicalMaterial("#f5f6f1", { roughness: 0.52 }),
  rubber: physicalMaterial("#27302f", { roughness: 0.84 }),
  steel: physicalMaterial("#aebbb8", { metalness: 0.84, roughness: 0.2 }),
  amberGlass: physicalMaterial("#6a3c13", {
    transparent: true,
    opacity: 0.8,
    transmission: 0.18,
    thickness: 0.025,
    roughness: 0.14,
    metalness: 0,
    envMapIntensity: 1.05,
  }),
  clearGlass: physicalMaterial("#dcebea", {
    transparent: true,
    opacity: 0.52,
    transmission: 0.48,
    thickness: 0.018,
    roughness: 0.08,
    metalness: 0,
    depthWrite: false,
    envMapIntensity: 1.15,
  }),
  bottleWhite: physicalMaterial("#e9edeb", { roughness: 0.4, clearcoat: 0.18 }),
  capBlue: physicalMaterial("#246ca3", { roughness: 0.5 }),
  capBlack: physicalMaterial("#202827", { roughness: 0.72 }),
  capWhite: physicalMaterial("#e9efec", { roughness: 0.5 }),
  traySilver: physicalMaterial("#b8c4c1", { metalness: 0.76, roughness: 0.25 }),
  trayWhite: physicalMaterial("#edf2ef", { roughness: 0.42, clearcoat: 0.12 }),
  trayBlue: physicalMaterial("#6f9eb0", { metalness: 0.08, roughness: 0.46 }),
  trayGreen: physicalMaterial("#7ca99c", { metalness: 0.06, roughness: 0.48 }),
  carton: physicalMaterial("#c6b397", { roughness: 0.78 }),
  paper: physicalMaterial("#f6f7f2", { roughness: 0.72 }),
  screen: physicalMaterial("#163f45", {
    emissive: new THREE.Color("#143d43"),
    emissiveIntensity: 0.7,
    roughness: 0.18,
    clearcoat: 0.35,
  }),
  screenLine: physicalMaterial("#62c8b9", {
    emissive: new THREE.Color("#62c8b9"),
    emissiveIntensity: 1.4,
    roughness: 0.22,
    toneMapped: false,
  }),
  teal: physicalMaterial("#1d9d8e", { roughness: 0.4 }),
  blue: physicalMaterial("#4e8fa9", { roughness: 0.42 }),
  green: physicalMaterial("#6c9d82", { roughness: 0.46 }),
  liquidBlue: physicalMaterial("#43a9c8", { transparent: true, opacity: 0.64, roughness: 0.18 }),
  liquidAmber: physicalMaterial("#b6752c", { transparent: true, opacity: 0.64, roughness: 0.2 }),
  liquidClear: physicalMaterial("#dcecea", { transparent: true, opacity: 0.28, roughness: 0.12 }),
  tubingBlue: physicalMaterial("#6eaec4", { transparent: true, opacity: 0.72, roughness: 0.28 }),
};

const ignoreRaycast: THREE.Mesh["raycast"] = () => undefined;

function ContextMesh({
  geometry,
  material,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  castShadow = true,
  receiveShadow = false,
}: MeshTransform & {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      raycast={ignoreRaycast}
      dispose={null}
    />
  );
}

function CeilingLight({ position }: { position: EnvironmentPoint }) {
  return (
    <group position={position} dispose={null}>
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.ceilingWhite}
        scale={[1.56, 0.065, 0.17]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.light}
        position={[0, -0.039, 0]}
        scale={[1.43, 0.018, 0.115]}
        castShadow={false}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.aluminum}
        position={[-0.75, -0.004, 0]}
        scale={[0.035, 0.075, 0.19]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.aluminum}
        position={[0.75, -0.004, 0]}
        scale={[0.035, 0.075, 0.19]}
      />
    </group>
  );
}

function VentPanel({ position }: { position: EnvironmentPoint }) {
  return (
    <group position={position} dispose={null}>
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.ceilingWhite}
        scale={[0.79, 0.055, 0.79]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.ventDark}
        position={[0, 0.031, 0]}
        scale={[0.67, 0.012, 0.67]}
        castShadow={false}
      />
      {[-0.27, -0.18, -0.09, 0, 0.09, 0.18, 0.27].map((offset) => (
        <ContextMesh
          key={offset}
          geometry={UNIT_BOX}
          material={materials.aluminum}
          position={[offset, 0.045, 0]}
          rotation={[0, 0, -0.08]}
          scale={[0.026, 0.027, 0.61]}
          castShadow={false}
        />
      ))}
    </group>
  );
}

function CoiledPowerDrop({ position }: { position: EnvironmentPoint }) {
  return (
    <group position={position} dispose={null}>
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={materials.ceilingWhite}
        position={[0, 0.035, 0]}
        scale={[0.075, 0.07, 0.075]}
      />
      <ContextMesh
        geometry={COILED_DROP}
        material={materials.cable}
        position={[0, -0.025, 0]}
        castShadow={false}
      />
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={materials.cable}
        position={[0, -0.84, 0]}
        scale={[0.015, 0.24, 0.015]}
        castShadow={false}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.plug}
        position={[0, -0.985, 0]}
        scale={[0.08, 0.16, 0.06]}
      />
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={materials.rubber}
        position={[-0.025, -1.065, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.012, 0.028, 0.012]}
      />
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={materials.rubber}
        position={[0.025, -1.065, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.012, 0.028, 0.012]}
      />
    </group>
  );
}

function EnvironmentMemberMesh({
  member,
  geometry,
  material,
}: {
  member: EnvironmentMember;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  return (
    <ContextMesh
      geometry={geometry}
      material={material}
      position={member.position}
      rotation={member.rotation}
      scale={member.scale}
    />
  );
}

function ServiceInfrastructure({ profile }: { profile: LaboratoryEnvironmentProfile }) {
  return (
    <group dispose={null}>
      {profile.servicePosts.map((member, index) => (
        <EnvironmentMemberMesh
          key={`post-${index}`}
          member={member}
          geometry={UNIT_CYLINDER}
          material={materials.steel}
        />
      ))}
      {profile.serviceCrossbars.map((member, index) => (
        <EnvironmentMemberMesh
          key={`crossbar-${index}`}
          member={member}
          geometry={UNIT_CYLINDER}
          material={materials.steel}
        />
      ))}
      {profile.serviceRails.map((member, index) => (
        <EnvironmentMemberMesh
          key={`service-rail-${index}`}
          member={member}
          geometry={UNIT_BOX}
          material={materials.aluminum}
        />
      ))}
    </group>
  );
}

function Bottle({ bottle }: { bottle: EnvironmentBottle }) {
  const bodyMaterial =
    bottle.material === "amber"
      ? materials.amberGlass
      : bottle.material === "clear"
        ? materials.clearGlass
        : materials.bottleWhite;
  const capMaterial =
    bottle.cap === "blue"
      ? materials.capBlue
      : bottle.cap === "black"
        ? materials.capBlack
        : materials.capWhite;
  const labelAccent =
    bottle.cap === "blue"
      ? materials.blue
      : bottle.cap === "black"
        ? materials.teal
        : materials.green;
  const height = 0.22 * bottle.scale;
  return (
    <group position={bottle.position} dispose={null}>
      <ContextMesh
        geometry={REAGENT_BOTTLE_BODY}
        material={bodyMaterial}
        position={[0, height * 0.38, 0]}
        scale={[0.09 * bottle.scale, height * 0.7, 0.09 * bottle.scale]}
      />
      {bottle.material !== "white" && (
        <ContextMesh
          geometry={UNIT_CYLINDER}
          material={bottle.material === "amber" ? materials.liquidAmber : materials.liquidClear}
          position={[0, height * 0.25, 0]}
          scale={[0.074 * bottle.scale, height * 0.36, 0.074 * bottle.scale]}
          castShadow={false}
        />
      )}
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={bodyMaterial}
        position={[0, height * 0.8, 0]}
        scale={[0.044 * bottle.scale, height * 0.22, 0.044 * bottle.scale]}
      />
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={capMaterial}
        position={[0, height * 0.96, 0]}
        scale={[0.054 * bottle.scale, height * 0.09, 0.054 * bottle.scale]}
      />
      {[0.935, 0.965, 0.995].map((ratio) => (
        <ContextMesh
          key={ratio}
          geometry={UNIT_TORUS}
          material={capMaterial}
          position={[0, height * ratio, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.045 * bottle.scale, 0.045 * bottle.scale, 0.045 * bottle.scale]}
          castShadow={false}
        />
      ))}
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={materials.bottleWhite}
        position={[0, height * 0.46, 0]}
        scale={[0.091 * bottle.scale, height * 0.18, 0.091 * bottle.scale]}
        castShadow={false}
      />
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={labelAccent}
        position={[0, height * 0.55, 0]}
        scale={[0.092 * bottle.scale, height * 0.025, 0.092 * bottle.scale]}
        castShadow={false}
      />
      {[0.47, 0.43, 0.39].map((ratio, index) => (
        <ContextMesh
          key={ratio}
          geometry={UNIT_BOX}
          material={index === 0 ? materials.ventDark : materials.aluminum}
          position={[-0.006 + index * 0.004, height * ratio, 0.047 * bottle.scale]}
          scale={[(0.045 - index * 0.008) * bottle.scale, 0.004, 0.003]}
          castShadow={false}
        />
      ))}
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.paper}
        position={[0, height * 0.33, 0.047 * bottle.scale]}
        rotation={[0, 0, Math.PI / 4]}
        scale={[0.027 * bottle.scale, 0.027 * bottle.scale, 0.004]}
        castShadow={false}
      />
    </group>
  );
}

function Tray({ tray }: { tray: EnvironmentTray }) {
  const material =
    tray.color === "silver"
      ? materials.traySilver
      : tray.color === "blue"
        ? materials.trayBlue
        : tray.color === "green"
          ? materials.trayGreen
          : materials.trayWhite;
  const [width, height, depth] = tray.size;
  const compartments = Math.max(1, tray.compartments ?? 1);
  return (
    <group position={tray.position} rotation={tray.rotation} dispose={null}>
      <ContextMesh geometry={UNIT_BOX} material={material} scale={[width, height, depth]} />
      <ContextMesh
        geometry={UNIT_BOX}
        material={material}
        position={[0, height, -depth / 2]}
        scale={[width + 0.025, height * 1.7, 0.025]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={material}
        position={[0, height, depth / 2]}
        scale={[width + 0.025, height * 1.7, 0.025]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={material}
        position={[-width / 2, height, 0]}
        scale={[0.025, height * 1.7, depth]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={material}
        position={[width / 2, height, 0]}
        scale={[0.025, height * 1.7, depth]}
      />
      {Array.from({ length: compartments - 1 }, (_, index) => {
        const x = -width / 2 + (width / compartments) * (index + 1);
        return (
          <ContextMesh
            key={index}
            geometry={UNIT_BOX}
            material={materials.trayWhite}
            position={[x, height * 1.15, 0]}
            scale={[0.009, height * 1.1, depth * 0.88]}
            castShadow={false}
          />
        );
      })}
      {compartments > 1 && (
        <ContextMesh
          geometry={UNIT_BOX}
          material={materials.trayWhite}
          position={[0, height * 1.15, 0]}
          scale={[width * 0.96, height * 1.1, 0.009]}
          castShadow={false}
        />
      )}
      {Array.from({ length: compartments * 2 }, (_, index) => {
        const column = index % compartments;
        const row = Math.floor(index / compartments);
        const x = -width / 2 + (width / compartments) * (column + 0.5);
        const z = (row ? 1 : -1) * depth * 0.2;
        const radius = Math.min(0.019, width / compartments / 5);
        return (
          <group key={`sample-${index}`} position={[x, height * 1.8, z]}>
            <ContextMesh
              geometry={UNIT_CYLINDER}
              material={materials.clearGlass}
              scale={[radius, 0.065, radius]}
              castShadow={false}
            />
            <ContextMesh
              geometry={UNIT_CYLINDER}
              material={index % 3 === 0 ? materials.capBlue : materials.capWhite}
              position={[0, 0.04, 0]}
              scale={[radius * 1.12, 0.014, radius * 1.12]}
              castShadow={false}
            />
            <ContextMesh
              geometry={UNIT_CYLINDER}
              material={materials.paper}
              position={[0, 0.01, 0]}
              scale={[radius * 1.03, 0.017, radius * 1.03]}
              castShadow={false}
            />
          </group>
        );
      })}
    </group>
  );
}

function ConsumableBox({ box }: { box: EnvironmentConsumableBox }) {
  const [width, height, depth] = box.size;
  const bodyMaterial =
    box.finish === "silver"
      ? materials.traySilver
      : box.finish === "cardboard"
        ? materials.carton
        : materials.trayWhite;
  const accentMaterial =
    box.accent === "blue"
      ? materials.blue
      : box.accent === "green"
        ? materials.green
        : box.accent === "amber"
          ? materials.liquidAmber
          : materials.teal;
  return (
    <group position={box.position} rotation={box.rotation} dispose={null}>
      <ContextMesh
        geometry={UNIT_BOX}
        material={bodyMaterial}
        position={[0, height / 2, 0]}
        scale={[width, height, depth]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={accentMaterial}
        position={[0, height * 0.57, depth / 2 + 0.004]}
        scale={[width * 0.76, height * 0.18, 0.008]}
        castShadow={false}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.paper}
        position={[0, height * 0.34, depth / 2 + 0.006]}
        scale={[width * 0.5, height * 0.2, 0.006]}
        castShadow={false}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={bodyMaterial}
        position={[0, height + 0.004, 0]}
        scale={[width * 1.02, 0.012, depth * 1.02]}
        castShadow={false}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={accentMaterial}
        position={[0, height + 0.012, -depth * 0.2]}
        scale={[width * 0.74, 0.006, depth * 0.13]}
        castShadow={false}
      />
      {[-0.17, 0.17].map((offset) => (
        <ContextMesh
          key={offset}
          geometry={UNIT_BOX}
          material={materials.aluminum}
          position={[width * offset, height * 0.23, depth / 2 + 0.008]}
          scale={[0.006, height * 0.32, 0.004]}
          castShadow={false}
        />
      ))}
    </group>
  );
}

function Glassware({ item }: { item: EnvironmentGlassware }) {
  const bodyHeight = 0.22 * item.scale;
  const liquidMaterial =
    item.liquid === "blue"
      ? materials.liquidBlue
      : item.liquid === "amber"
        ? materials.liquidAmber
        : materials.liquidClear;
  const bodyGeometry = item.kind === "flask" ? GLASS_FLASK : OPEN_CYLINDER;
  const width = item.kind === "cylinder" ? 0.048 : item.kind === "flask" ? 0.1 : 0.085;
  const height =
    item.kind === "cylinder"
      ? bodyHeight * 1.38
      : item.kind === "flask"
        ? bodyHeight
        : bodyHeight * 0.82;
  return (
    <group position={item.position} rotation={item.rotation} dispose={null}>
      <ContextMesh
        geometry={bodyGeometry}
        material={materials.clearGlass}
        position={[0, height / 2, 0]}
        scale={[width, height, width]}
      />
      <ContextMesh
        geometry={UNIT_CYLINDER}
        material={liquidMaterial}
        position={[0, height * 0.26, 0]}
        scale={[width * 0.76, height * 0.36, width * 0.76]}
        castShadow={false}
      />
      {item.kind !== "flask" && (
        <ContextMesh
          geometry={UNIT_TORUS}
          material={materials.clearGlass}
          position={[0, height, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[width * 1.04, width * 1.04, width * 1.04]}
        />
      )}
      {item.kind !== "flask" && (
        <ContextMesh
          geometry={UNIT_TORUS}
          material={materials.clearGlass}
          position={[0, 0.012, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[width * 0.9, width * 0.9, width * 0.9]}
          castShadow={false}
        />
      )}
      {item.kind !== "flask" &&
        [0.28, 0.4, 0.52, 0.64].map((ratio, index) => (
          <ContextMesh
            key={ratio}
            geometry={UNIT_BOX}
            material={materials.steel}
            position={[width * 0.25, height * ratio, width * 0.5 + 0.003]}
            scale={[width * (index % 2 ? 0.18 : 0.28), 0.004, 0.004]}
            castShadow={false}
          />
        ))}
    </group>
  );
}

function MonitorStation({ monitor }: { monitor: EnvironmentMonitor }) {
  const scale = monitor.scale ?? 1;
  return (
    <group position={monitor.position} rotation={monitor.rotation} scale={scale} dispose={null}>
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.aluminum}
        position={[0, 0.31, 0]}
        scale={[0.5, 0.31, 0.035]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.screen}
        position={[0, 0.31, 0.021]}
        scale={[0.445, 0.255, 0.012]}
        castShadow={false}
      />
      {[0.12, 0.04, -0.04].map((y, index) => (
        <ContextMesh
          key={y}
          geometry={UNIT_BOX}
          material={index === 0 ? materials.screenLine : materials.trayWhite}
          position={[-0.06 + index * 0.035, 0.31 + y, 0.029]}
          scale={[0.25 - index * 0.035, 0.009, 0.006]}
          castShadow={false}
        />
      ))}
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.steel}
        position={[0, 0.115, -0.005]}
        scale={[0.035, 0.11, 0.035]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.steel}
        position={[0, 0.055, 0.015]}
        scale={[0.24, 0.018, 0.14]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.traySilver}
        position={[0, 0.018, 0.22]}
        scale={[0.42, 0.018, 0.13]}
      />
    </group>
  );
}

function DocumentBoard({ board }: { board: EnvironmentDocumentBoard }) {
  const scale = board.scale ?? 1;
  const accent =
    board.accent === "blue"
      ? materials.blue
      : board.accent === "green"
        ? materials.green
        : materials.teal;
  return (
    <group position={board.position} rotation={board.rotation} scale={scale} dispose={null}>
      <ContextMesh geometry={UNIT_BOX} material={materials.aluminum} scale={[0.52, 0.68, 0.035]} />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.paper}
        position={[0, 0, 0.025]}
        scale={[0.45, 0.6, 0.012]}
        castShadow={false}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={accent}
        position={[0, 0.22, 0.034]}
        scale={[0.38, 0.045, 0.008]}
        castShadow={false}
      />
      {[-0.08, -0.16, -0.24].map((y, index) => (
        <ContextMesh
          key={y}
          geometry={UNIT_BOX}
          material={materials.aluminum}
          position={[-0.04 + index * 0.025, y, 0.034]}
          scale={[0.31 - index * 0.04, 0.012, 0.008]}
          castShadow={false}
        />
      ))}
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.steel}
        position={[0, 0.355, 0.028]}
        scale={[0.13, 0.055, 0.045]}
      />
    </group>
  );
}

function PipetteRack({ rack }: { rack: EnvironmentPipetteRack }) {
  const scale = rack.scale ?? 1;
  const colors = [materials.teal, materials.blue, materials.green, materials.trayWhite];
  return (
    <group position={rack.position} rotation={rack.rotation} scale={scale} dispose={null}>
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.traySilver}
        position={[0, 0.018, 0]}
        scale={[0.34, 0.036, 0.15]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.aluminum}
        position={[0, 0.2, 0]}
        scale={[0.035, 0.37, 0.035]}
      />
      <ContextMesh
        geometry={UNIT_BOX}
        material={materials.aluminum}
        position={[0, 0.34, 0]}
        scale={[0.34, 0.028, 0.08]}
      />
      {[-0.12, -0.04, 0.04, 0.12].map((x, index) => (
        <group key={x} position={[x, 0.2, 0.018]} rotation={[0, 0, index % 2 ? -0.06 : 0.06]}>
          <ContextMesh
            geometry={UNIT_CYLINDER}
            material={materials.trayWhite}
            scale={[0.026, 0.25, 0.026]}
          />
          <ContextMesh
            geometry={UNIT_CYLINDER}
            material={colors[index]}
            position={[0, 0.13, 0]}
            scale={[0.036, 0.075, 0.036]}
          />
          <ContextMesh
            geometry={UNIT_CYLINDER}
            material={materials.steel}
            position={[0, -0.15, 0]}
            scale={[0.009, 0.1, 0.009]}
          />
        </group>
      ))}
    </group>
  );
}

function TubingRun({ run }: { run: EnvironmentTubingRun }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        run.points.map((point) => new THREE.Vector3(...point)),
        false,
        "centripetal",
      ),
    [run.points],
  );
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 48, run.radius ?? 0.009, 7, false),
    [curve, run.radius],
  );
  const material =
    run.color === "blue"
      ? materials.tubingBlue
      : run.color === "white"
        ? materials.cable
        : materials.clearGlass;
  const radius = run.radius ?? 0.009;
  const endpoints = [run.points[0], run.points[run.points.length - 1]].filter(
    (point): point is EnvironmentPoint => Boolean(point),
  );
  return (
    <group dispose={null}>
      <ContextMesh geometry={geometry} material={material} castShadow={false} />
      {endpoints.map((point, index) => (
        <group key={index} position={point}>
          <ContextMesh
            geometry={UNIT_SPHERE}
            material={materials.steel}
            scale={[radius * 3.8, radius * 3.8, radius * 3.8]}
            castShadow={false}
          />
          <ContextMesh
            geometry={UNIT_SPHERE}
            material={material}
            scale={[radius * 2.25, radius * 2.25, radius * 2.25]}
            castShadow={false}
          />
        </group>
      ))}
    </group>
  );
}

function Ductwork({ profile }: { profile: LaboratoryEnvironmentProfile }) {
  return (
    <group dispose={null}>
      {profile.ductRuns.map((member, index) => (
        <EnvironmentMemberMesh
          key={`duct-run-${index}`}
          member={member}
          geometry={UNIT_CYLINDER}
          material={materials.duct}
        />
      ))}
      {profile.ductCollars.map((member, index) => (
        <EnvironmentMemberMesh
          key={`duct-collar-${index}`}
          member={member}
          geometry={UNIT_TORUS}
          material={materials.aluminum}
        />
      ))}
      {profile.ductTerminals.map((member, index) => (
        <EnvironmentMemberMesh
          key={`duct-terminal-${index}`}
          member={member}
          geometry={UNIT_BOX}
          material={materials.aluminum}
        />
      ))}
    </group>
  );
}

function EnvironmentLightingRig({ profile }: { profile: LaboratoryEnvironmentProfile }) {
  return (
    <group dispose={null}>
      {profile.areaLights.map((light, index) => (
        <rectAreaLight key={`area-light-${index}`} {...light} />
      ))}
    </group>
  );
}

export function LaboratoryEnvironment({
  room,
  visible = true,
  overheadVisible = true,
}: {
  room: Pick<Room, "environmentProfileId">;
  visible?: boolean;
  overheadVisible?: boolean;
}) {
  const profile = getLaboratoryEnvironmentProfile(room);
  if (!profile) return null;

  return (
    <group name={`${profile.name} environmental context`} dispose={null}>
      {visible && (
        <group name={`${profile.name} visible service geometry`} dispose={null}>
          {overheadVisible && (
            <group name={`${profile.name} overhead services`} dispose={null}>
              {profile.lightFixtures.map((position, index) => (
                <CeilingLight key={`light-${index}`} position={position} />
              ))}
              {profile.ceilingRails.map((rail, index) => (
                <ContextMesh
                  key={`ceiling-rail-${index}`}
                  geometry={UNIT_BOX}
                  material={materials.aluminum}
                  position={rail.position}
                  scale={
                    rail.axis === "x" ? [rail.length, 0.045, 0.055] : [0.055, 0.045, rail.length]
                  }
                />
              ))}
              {profile.vents.map((position, index) => (
                <VentPanel key={`vent-${index}`} position={position} />
              ))}
              {profile.powerDrops.map((position, index) => (
                <CoiledPowerDrop key={`drop-${index}`} position={position} />
              ))}
              <Ductwork profile={profile} />
              <ServiceInfrastructure profile={profile} />
            </group>
          )}
          {profile.bottles.map((bottle, index) => (
            <Bottle key={`bottle-${index}`} bottle={bottle} />
          ))}
          {profile.trays.map((tray, index) => (
            <Tray key={`tray-${index}`} tray={tray} />
          ))}
          {profile.glassware.map((item, index) => (
            <Glassware key={`glassware-${index}`} item={item} />
          ))}
          {profile.monitors.map((monitor, index) => (
            <MonitorStation key={`monitor-${index}`} monitor={monitor} />
          ))}
          {profile.documentBoards.map((board, index) => (
            <DocumentBoard key={`document-board-${index}`} board={board} />
          ))}
          {profile.pipetteRacks.map((rack, index) => (
            <PipetteRack key={`pipette-rack-${index}`} rack={rack} />
          ))}
          {profile.consumableBoxes.map((box, index) => (
            <ConsumableBox key={`consumable-box-${index}`} box={box} />
          ))}
          {profile.tubingRuns.map((run, index) => (
            <TubingRun key={`tubing-${index}`} run={run} />
          ))}
        </group>
      )}
      <EnvironmentLightingRig profile={profile} />
    </group>
  );
}
