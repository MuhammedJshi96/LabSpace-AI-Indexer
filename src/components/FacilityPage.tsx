import {
  ArrowRight,
  Buildings,
  DoorOpen,
  MagicWand,
  PresentationChart,
  Ruler,
  StackSimple,
} from "@phosphor-icons/react";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getAssetDefinition } from "../domain/assets";
import {
  FACILITY_FLOORS,
  facilityFloorBounds,
  inferFacilityFloorFromRoomCode,
  nextFacilityRoomPlacement,
  resolveFacilityFloorLayout,
  type FacilityFloorBounds,
  type FacilityRoomLayoutEntry,
  type FacilityRoomLayoutInput,
} from "../domain/facility";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import type { Room, SceneObject } from "../domain/schema";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";
import { AssetVisual } from "./AssetVisual";
import { Dialogs, Toasts } from "./Dialogs";
import { RoomFloor3D } from "./RoomFloor3D";
import { TopBar } from "./TopBar";

function clampFloorIndex(value: number) {
  return Math.max(0, Math.min(14, Math.round(value)));
}

function roomPlacement(room: Room, index = 0) {
  const inferred = inferFacilityFloorFromRoomCode(room.code);
  return (
    room.facilityPlacement ?? {
      floor: inferred ? inferred - 1 : clampFloorIndex(index),
      x: 0,
      y: 0,
      rotation: 0,
    }
  );
}

function roomFloor(room: Room, index = 0) {
  return clampFloorIndex(roomPlacement(room, index).floor) + 1;
}

function roomLayoutInput(room: Room, index = 0): FacilityRoomLayoutInput {
  const placement = roomPlacement(room, index);
  return {
    id: room.id,
    widthMm: room.width,
    depthMm: room.depth,
    xMm: placement.x,
    yMm: placement.y,
    rotationDeg: placement.rotation,
  };
}

function metres(value: number) {
  return `${(value / 1000).toFixed(1)} m`;
}

function visibleFacilityObjects(objects: SceneObject[]) {
  return objects.filter(
    (object) => object.visible && !["wall", "label", "measurement"].includes(object.objectType),
  );
}

function representativeObjects(objects: SceneObject[]) {
  const priority: Record<string, number> = {
    equipment: 0,
    storage: 1,
    furniture: 2,
    safety: 3,
    utility: 4,
    door: 5,
    window: 6,
    architecture: 7,
  };
  return visibleFacilityObjects(objects)
    .sort(
      (first, second) =>
        (priority[first.objectType] ?? 8) - (priority[second.objectType] ?? 8) ||
        first.zIndex - second.zIndex,
    )
    .slice(0, 24);
}

type PositionedRoom = FacilityRoomLayoutEntry & {
  room: Room;
};

function layoutRoomsOnFloor(rooms: Room[]): PositionedRoom[] {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  return resolveFacilityFloorLayout(rooms.map(roomLayoutInput)).map((entry) => ({
    ...entry,
    room: byId.get(entry.id)!,
  }));
}

function FacilityFloorEnvelope({
  buildingBounds,
  sectionY,
  selected,
}: {
  buildingBounds: FacilityFloorBounds;
  sectionY: number;
  selected: boolean;
}) {
  const padding = 0.72;
  const width = buildingBounds.maxX - buildingBounds.minX + padding * 2;
  const depth = buildingBounds.maxZ - buildingBounds.minZ + padding * 2;
  const centerX = (buildingBounds.minX + buildingBounds.maxX) / 2;
  const centerZ = (buildingBounds.minZ + buildingBounds.maxZ) / 2;
  const wallThickness = 0.18;
  const wallHeight = 1.22;
  const cutawayHeight = 0.2;

  return (
    <group position={[centerX, sectionY, centerZ]}>
      <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.24, depth]} />
        <meshPhysicalMaterial
          color={selected ? "#cbe9e2" : "#c7d2cf"}
          metalness={0.16}
          roughness={0.48}
          clearcoat={0.14}
          clearcoatRoughness={0.42}
        />
      </mesh>
      <mesh position={[0, wallHeight / 2, -depth / 2 + wallThickness / 2]} castShadow>
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshPhysicalMaterial color="#e3e8e6" roughness={0.58} clearcoat={0.08} />
      </mesh>
      <mesh position={[-width / 2 + wallThickness / 2, wallHeight / 2, 0]} castShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshPhysicalMaterial color="#dce3e0" roughness={0.58} clearcoat={0.08} />
      </mesh>
      <mesh position={[0, cutawayHeight / 2, depth / 2 - wallThickness / 2]} castShadow>
        <boxGeometry args={[width, cutawayHeight, wallThickness]} />
        <meshStandardMaterial color="#879b96" metalness={0.24} roughness={0.4} />
      </mesh>
      <mesh position={[width / 2 - wallThickness / 2, cutawayHeight / 2, 0]} castShadow>
        <boxGeometry args={[wallThickness, cutawayHeight, depth]} />
        <meshStandardMaterial color="#879b96" metalness={0.24} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.035, depth / 2 + 0.025]}>
        <boxGeometry args={[width, 0.1, 0.05]} />
        <meshStandardMaterial
          color={selected ? "#20b9a2" : "#6f827d"}
          emissive={selected ? "#0b5d50" : "#000000"}
          emissiveIntensity={selected ? 0.32 : 0}
          metalness={0.42}
          roughness={0.34}
        />
      </mesh>
    </group>
  );
}

function FacilityBuildingFrame({ bounds, topY }: { bounds: FacilityFloorBounds; topY: number }) {
  const padding = 0.72;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const depth = bounds.maxZ - bounds.minZ + padding * 2;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const bottomY = -0.32;
  const height = topY - bottomY;
  const columnSize = 0.16;
  const rearZ = -depth / 2 + columnSize / 2;
  const leftX = -width / 2 + columnSize / 2;
  const rightX = width / 2 - columnSize / 2;
  const frontZ = depth / 2 - columnSize / 2;

  return (
    <group position={[centerX, 0, centerZ]}>
      <mesh position={[0, bottomY - 0.11, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.28, 0.16, depth + 0.28]} />
        <meshPhysicalMaterial color="#7e908c" metalness={0.32} roughness={0.42} />
      </mesh>
      {[
        [leftX, rearZ],
        [rightX, rearZ],
        [leftX, frontZ],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, bottomY + height / 2, z]} castShadow>
          <boxGeometry args={[columnSize, height, columnSize]} />
          <meshPhysicalMaterial color="#73847f" metalness={0.5} roughness={0.3} clearcoat={0.12} />
        </mesh>
      ))}
      <mesh position={[0, bottomY + height / 2, rearZ]}>
        <boxGeometry args={[width, height, 0.045]} />
        <meshPhysicalMaterial
          color="#c8dad5"
          transparent
          opacity={0.11}
          depthWrite={false}
          roughness={0.28}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[leftX, bottomY + height / 2, 0]}>
        <boxGeometry args={[0.045, height, depth]} />
        <meshPhysicalMaterial
          color="#c8dad5"
          transparent
          opacity={0.09}
          depthWrite={false}
          roughness={0.28}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, topY, rearZ]} castShadow>
        <boxGeometry args={[width, columnSize, columnSize]} />
        <meshStandardMaterial color="#657772" metalness={0.46} roughness={0.33} />
      </mesh>
      <mesh position={[leftX, topY, 0]} castShadow>
        <boxGeometry args={[columnSize, columnSize, depth]} />
        <meshStandardMaterial color="#657772" metalness={0.46} roughness={0.33} />
      </mesh>
    </group>
  );
}

type RoomMiniatureProps = {
  room: Room;
  x: number;
  z: number;
  sectionY: number;
  selected: boolean;
  onSelect: (roomId: string) => void;
  onOpen: (roomId: string) => void;
};

function RoomMiniature({ room, x, z, sectionY, selected, onSelect, onOpen }: RoomMiniatureProps) {
  const width = room.width / 1000;
  const depth = room.depth / 1000;
  const placement = roomPlacement(room);
  const walls = room.scene.objects.filter((object) => object.visible && object.wall);
  const objects = representativeObjects(room.scene.objects);
  const hasClosedFloor = Boolean(getClosedWallFloorPolygon(room.scene.objects));
  const chooseRoom = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect(room.id);
  };

  return (
    <group
      position={[x, sectionY, z]}
      rotation={[0, THREE.MathUtils.degToRad(-placement.rotation), 0]}
    >
      <mesh
        position={[0, -0.055, 0]}
        castShadow
        receiveShadow
        onClick={chooseRoom}
        onDoubleClick={(event) => {
          event.stopPropagation();
          void onOpen(room.id);
        }}
      >
        <boxGeometry args={[width + 0.12, 0.07, depth + 0.12]} />
        <meshPhysicalMaterial
          color={selected ? "#67c7b6" : "#b8c4c1"}
          metalness={0.12}
          roughness={0.5}
          clearcoat={0.1}
          clearcoatRoughness={0.4}
        />
      </mesh>
      {hasClosedFloor ? (
        <RoomFloor3D room={room} onClearSelection={() => onSelect(room.id)} />
      ) : (
        <mesh position={[0, 0, 0]} receiveShadow onClick={chooseRoom}>
          <boxGeometry args={[width, 0.035, depth]} />
          <meshStandardMaterial color="#d4dad7" roughness={0.7} />
        </mesh>
      )}

      {walls.map((object) => {
        const wall = object.wall!;
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.max(0.12, Math.hypot(dx, dy) / 1000);
        const wallHeight = Math.min(1.08, wall.height / 1000);
        const wallX = (wall.start.x + wall.end.x) / 2000 - width / 2;
        const wallZ = (wall.start.y + wall.end.y) / 2000 - depth / 2;
        const angle = -Math.atan2(dy, dx);
        return (
          <group key={object.id} position={[wallX, 0, wallZ]} rotation={[0, angle, 0]}>
            <mesh position={[0, wallHeight / 2, 0]} castShadow receiveShadow onClick={chooseRoom}>
              <boxGeometry args={[length, wallHeight, Math.max(0.065, wall.thickness / 1000)]} />
              <meshPhysicalMaterial
                color={selected ? "#eef8f5" : "#e3e7e5"}
                metalness={0.02}
                roughness={0.58}
                clearcoat={0.08}
              />
            </mesh>
            <mesh position={[0, 0.045, -Math.max(0.04, wall.thickness / 1900)]}>
              <boxGeometry args={[length, 0.09, 0.018]} />
              <meshStandardMaterial color="#7d8986" metalness={0.34} roughness={0.4} />
            </mesh>
          </group>
        );
      })}

      {objects.map((object) => {
        const definition = getAssetDefinition(object.assetDefinitionId);
        return (
          <group
            key={object.id}
            position={[
              object.position.x / 1000 - width / 2,
              object.position.z / 1000,
              object.position.y / 1000 - depth / 2,
            ]}
            rotation={[0, THREE.MathUtils.degToRad(-object.rotation.z), 0]}
            scale={[object.flipHorizontal ? -1 : 1, 1, object.flipVertical ? -1 : 1]}
            onClick={chooseRoom}
          >
            <AssetVisual
              definition={definition}
              width={object.dimensions.width / 1000}
              depth={object.dimensions.depth / 1000}
              height={object.dimensions.height / 1000}
              detail="room"
            />
          </group>
        );
      })}
    </group>
  );
}

type FacilityStackViewProps = {
  rooms: Room[];
  selectedRoomId: string | undefined;
  floorFilter: number | "all";
  onSelect: (roomId: string) => void;
  onOpen: (roomId: string) => void;
};

function FacilityStackView({
  rooms,
  selectedRoomId,
  floorFilter,
  onSelect,
  onOpen,
}: FacilityStackViewProps) {
  const floorScenes = useMemo(() => {
    const grouped = new Map<number, Room[]>();
    rooms.forEach((room, index) => {
      const floor = roomFloor(room, index);
      if (floorFilter !== "all" && floor !== floorFilter) return;
      grouped.set(floor, [...(grouped.get(floor) ?? []), room]);
    });
    return Array.from(grouped.entries())
      .sort(([first], [second]) => first - second)
      .map(([floor, floorRooms], index) => ({
        floor,
        sectionY: index * 3.5,
        rooms: layoutRoomsOnFloor(floorRooms),
      }));
  }, [floorFilter, rooms]);
  const maxSpan = Math.max(
    9,
    ...floorScenes.flatMap((scene) =>
      scene.rooms.flatMap((entry) => [
        Math.abs(entry.x) * 2 + entry.footprintWidth,
        Math.abs(entry.z) * 2 + entry.footprintDepth,
      ]),
    ),
  );
  const stackHeight = Math.max(1.5, (floorScenes.length - 1) * 3.5);
  const buildingBounds = facilityFloorBounds(floorScenes.flatMap((scene) => scene.rooms));
  const buildingTopY = Math.max(1.45, ...floorScenes.map((scene) => scene.sectionY + 1.45));
  const singleFloor = floorScenes.length <= 1;
  const framingSpan = singleFloor
    ? Math.max(6.8, maxSpan * 0.76)
    : Math.max(maxSpan, stackHeight * 1.55 + 5);
  const sceneKey = floorScenes.map((scene) => scene.floor).join("-") || "empty";

  return (
    <Canvas
      key={sceneKey}
      shadows
      dpr={[1, 1.45]}
      camera={{
        position: [
          framingSpan,
          singleFloor ? 6.4 : stackHeight * 0.72 + 8,
          framingSpan * (singleFloor ? 0.92 : 1.12),
        ],
        fov: 40,
        near: 0.1,
        far: 220,
      }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#e9f0ee"]} />
      <fog attach="fog" args={["#e9f0ee", 42, 120]} />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#ffffff"
          position={[6, 14, 8]}
          rotation={[-Math.PI / 4, 0.35, 0]}
          scale={[10, 10, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.15}
          color="#c9e7e0"
          position={[-9, 7, -8]}
          rotation={[0.2, -Math.PI / 3, 0]}
          scale={[8, 6, 1]}
        />
      </Environment>
      <hemisphereLight color="#f7fffc" groundColor="#606864" intensity={0.65} />
      <ambientLight intensity={0.28} />
      <directionalLight
        castShadow
        intensity={2.35}
        position={[14, 22, 12]}
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      />
      <directionalLight intensity={0.65} position={[-12, 10, -8]} color="#d5eee8" />
      <gridHelper args={[100, 100, "#adc7c1", "#d5e3df"]} position={[0, -0.22, 0]} />
      <FacilityBuildingFrame bounds={buildingBounds} topY={buildingTopY} />
      {floorScenes.map((scene) => (
        <group key={`facility-floor-${scene.floor}`}>
          <FacilityFloorEnvelope
            buildingBounds={buildingBounds}
            sectionY={scene.sectionY}
            selected={scene.rooms.some((entry) => entry.room.id === selectedRoomId)}
          />
          {scene.rooms.map((entry) => (
            <RoomMiniature
              key={entry.room.id}
              room={entry.room}
              x={entry.x}
              z={entry.z}
              sectionY={scene.sectionY}
              selected={selectedRoomId === entry.room.id}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))}
        </group>
      ))}
      <OrbitControls
        makeDefault
        target={[0, stackHeight / 2, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={90}
        maxPolarAngle={Math.PI * 0.49}
      />
    </Canvas>
  );
}

export function FacilityPage() {
  const hydrate = useEditorStore((state) => state.hydrate);
  const hydrated = useEditorStore((state) => state.hydrated);
  const saveNow = useEditorStore((state) => state.saveNow);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const dirtyRevision = useEditorStore((state) => state.dirtyRevision);
  const project = useEditorStore((state) => state.project);
  const activeRoom = useEditorStore(selectActiveRoom);
  const switchRoom = useEditorStore((state) => state.switchRoom);
  const updatePlacement = useEditorStore((state) => state.updateRoomFacilityPlacement);
  const pushToast = useEditorStore((state) => state.pushToast);
  const [laboratoryId, setLaboratoryId] = useState(activeRoom.laboratoryId);
  const [selectedRoomId, setSelectedRoomId] = useState(activeRoom.id);
  const [floorFilter, setFloorFilter] = useState<number | "all">("all");
  const [openingRoomId, setOpeningRoomId] = useState<string | null>(null);
  const openingRoomRef = useRef<string | null>(null);

  useEffect(() => void hydrate(), [hydrate]);
  useEffect(() => {
    if (!hydrated || saveStatus !== "unsaved" || dirtyRevision === 0) return;
    const timer = window.setTimeout(() => void saveNow(), 900);
    return () => window.clearTimeout(timer);
  }, [dirtyRevision, hydrated, saveNow, saveStatus]);

  const laboratory =
    project.laboratories.find((entry) => entry.id === laboratoryId) ?? project.laboratories[0];
  const laboratoryRooms = useMemo(
    () =>
      project.rooms
        .filter((room) => room.laboratoryId === laboratory?.id && room.roomKind !== "demo-template")
        .sort((first, second) => {
          const floorDelta = roomFloor(first) - roomFloor(second);
          return floorDelta || first.code.localeCompare(second.code);
        }),
    [laboratory?.id, project.rooms],
  );
  const occupiedFloors = useMemo(
    () => Array.from(new Set(laboratoryRooms.map((room) => roomFloor(room)))).sort((a, b) => a - b),
    [laboratoryRooms],
  );
  const roomsByFloor = useMemo(
    () =>
      occupiedFloors
        .map((floor) => ({
          floor,
          rooms: laboratoryRooms.filter((room) => roomFloor(room) === floor),
        }))
        .reverse(),
    [laboratoryRooms, occupiedFloors],
  );
  const selectedRoom =
    laboratoryRooms.find((room) => room.id === selectedRoomId) ?? laboratoryRooms[0];
  const selectedFloor = selectedRoom ? roomFloor(selectedRoom) : 1;
  const suggestedFloor = selectedRoom ? inferFacilityFloorFromRoomCode(selectedRoom.code) : null;

  const openRoom = async (roomId: string) => {
    if (openingRoomRef.current) return;
    openingRoomRef.current = roomId;
    setOpeningRoomId(roomId);
    switchRoom(roomId);
    if (useEditorStore.getState().project.activeRoomId !== roomId) {
      openingRoomRef.current = null;
      setOpeningRoomId(null);
      return;
    }

    const persisted = await new Promise<boolean>((resolve) => {
      let settled = false;
      let timeout = 0;
      let unsubscribe: () => void = () => undefined;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(result);
      };
      unsubscribe = useEditorStore.subscribe((state) => {
        if (state.project.activeRoomId !== roomId || state.saveStatus === "error") finish(false);
        else if (state.saveStatus === "saved") finish(true);
      });
      timeout = window.setTimeout(() => finish(false), 12_000);
      void useEditorStore.getState().saveNow();
    });

    if (!persisted) {
      pushToast("The selected room could not be saved. Stay in Facility and try again.", "error");
      openingRoomRef.current = null;
      setOpeningRoomId(null);
      return;
    }
    window.location.assign("/");
  };

  const selectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = laboratoryRooms.find((entry) => entry.id === roomId);
    if (floorFilter !== "all" && room) setFloorFilter(roomFloor(room));
  };

  const assignRoomToFloor = (room: Room, floor: number) => {
    const joiningFloor = roomFloor(room) !== floor;
    const floorPeers = laboratoryRooms.filter(
      (candidate) => candidate.id !== room.id && roomFloor(candidate) === floor,
    );
    const openPosition = joiningFloor
      ? nextFacilityRoomPlacement(floorPeers.map(roomLayoutInput), roomLayoutInput(room))
      : null;
    updatePlacement(room.id, {
      floor: floor - 1,
      ...(openPosition ?? {}),
    });
    if (floorFilter !== "all") setFloorFilter(floor);
  };

  const organizeFromRoomNumbers = () => {
    const assignments = laboratoryRooms.map((room, index) => ({
      room,
      floor: inferFacilityFloorFromRoomCode(room.code) ?? roomFloor(room, index),
    }));
    const grouped = new Map<number, typeof assignments>();
    assignments.forEach((entry) => {
      grouped.set(entry.floor, [...(grouped.get(entry.floor) ?? []), entry]);
    });
    let inferredCount = 0;
    grouped.forEach((entries) => {
      const packed = resolveFacilityFloorLayout(
        entries.map(({ room }) => ({ ...roomLayoutInput(room), xMm: 0, yMm: 0 })),
      );
      const packedById = new Map(packed.map((entry) => [entry.id, entry]));
      entries.forEach(({ room, floor }) => {
        if (inferFacilityFloorFromRoomCode(room.code)) inferredCount += 1;
        const layout = packedById.get(room.id)!;
        updatePlacement(room.id, {
          floor: floor - 1,
          x: Math.round((layout.x - room.width / 2000) * 1000),
          y: Math.round((layout.z - room.depth / 2000) * 1000),
        });
      });
    });
    setFloorFilter("all");
    pushToast(
      `${laboratoryRooms.length} rooms organized across floors; ${inferredCount} matched room numbering.`,
      "success",
    );
  };

  return (
    <div className="app-shell facility-shell">
      <TopBar activeArea="facility" contextLabel="Facility workspace" />
      <main className="facility-workspace">
        <aside className="facility-rail">
          <div className="facility-rail-heading">
            <span className="eyebrow">Laboratory navigator</span>
            <h1>Facility by floor</h1>
            <p>Group rooms on floors 1–15, then inspect the complete building section.</p>
          </div>
          <label>
            <span>Laboratory</span>
            <select
              value={laboratory?.id ?? ""}
              onChange={(event) => {
                setLaboratoryId(event.target.value);
                setFloorFilter("all");
                const next = project.rooms.find(
                  (room) =>
                    room.laboratoryId === event.target.value && room.roomKind !== "demo-template",
                );
                if (next) setSelectedRoomId(next.id);
              }}
            >
              {project.laboratories.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.code}
                </option>
              ))}
            </select>
          </label>
          <label className="facility-floor-view">
            <span>3D floor view</span>
            <select
              value={floorFilter}
              onChange={(event) =>
                setFloorFilter(event.target.value === "all" ? "all" : Number(event.target.value))
              }
            >
              <option value="all">All occupied floors</option>
              {occupiedFloors.map((floor) => (
                <option key={floor} value={floor}>
                  Floor {floor}
                </option>
              ))}
            </select>
          </label>
          <div className="facility-stack-summary">
            <StackSimple size={18} weight="duotone" />
            <span>
              <b>
                {occupiedFloors.length} occupied floor{occupiedFloors.length === 1 ? "" : "s"}
              </b>
              <small>{laboratoryRooms.length} rooms in this laboratory</small>
            </span>
          </div>
          <div className="facility-floor-groups" aria-label="Rooms grouped by facility floor">
            {roomsByFloor.map(({ floor, rooms }) => (
              <section className="facility-floor-group" key={floor}>
                <button
                  className={floorFilter === floor ? "active" : ""}
                  onClick={() => setFloorFilter(floorFilter === floor ? "all" : floor)}
                >
                  <span>F{String(floor).padStart(2, "0")}</span>
                  <b>Floor {floor}</b>
                  <small>
                    {rooms.length} room{rooms.length === 1 ? "" : "s"}
                  </small>
                </button>
                <div className="facility-room-list">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      className={selectedRoom?.id === room.id ? "active" : ""}
                      onClick={() => selectRoom(room.id)}
                      onDoubleClick={() => void openRoom(room.id)}
                    >
                      {room.roomKind === "demo" ? (
                        <PresentationChart size={17} />
                      ) : (
                        <DoorOpen size={17} />
                      )}
                      <span>
                        <b>{room.name}</b>
                        <small>
                          {room.code} · {room.scene.inventoryItems.length} inventory
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <button className="facility-arrange" onClick={organizeFromRoomNumbers}>
            <MagicWand size={17} /> Organize floors from room numbers
          </button>
          <p className="facility-arrange-note">
            Recognizes codes such as 813 or R809 as Floors 8. Rooms without a clear number keep
            their current floor.
          </p>
        </aside>

        <section className="facility-map-panel facility-stack-panel">
          <header>
            <span>
              <small>Continuous material-aware cutaway</small>
              <b>
                {laboratory?.name}
                {floorFilter === "all" ? " · All floors" : ` · Floor ${floorFilter}`}
              </b>
            </span>
            <em>Orbit · inspect · double-click a room to open</em>
          </header>
          <div
            className="facility-map facility-stack-canvas"
            aria-label="Three-dimensional facility floor stack"
            data-facility-render-mode="material-aware"
            data-facility-envelope="cutaway"
            data-building-frame="continuous-section"
          >
            {laboratoryRooms.length ? (
              <FacilityStackView
                rooms={laboratoryRooms}
                selectedRoomId={selectedRoom?.id}
                floorFilter={floorFilter}
                onSelect={selectRoom}
                onOpen={openRoom}
              />
            ) : (
              <div className="facility-map-empty">
                <Buildings size={34} />
                <b>No rooms in this laboratory</b>
                <span>Create a room from the project workspace.</span>
              </div>
            )}
            <div className="facility-stack-key">
              <span>
                <i className="selected" /> Selected room slab
              </span>
              <span>
                <i /> Continuous section frame
              </span>
            </div>
          </div>
        </section>

        <aside className="facility-inspector">
          {selectedRoom ? (
            <>
              <div className="facility-inspector-title">
                <span className="facility-room-symbol">
                  <Ruler size={20} />
                </span>
                <span>
                  <small>
                    FLOOR {selectedFloor} · {selectedRoom.code}
                  </small>
                  <h2>{selectedRoom.name}</h2>
                </span>
              </div>
              <div className="facility-stat-grid">
                <span>
                  <small>Width</small>
                  <b>{metres(selectedRoom.width)}</b>
                </span>
                <span>
                  <small>Depth</small>
                  <b>{metres(selectedRoom.depth)}</b>
                </span>
                <span>
                  <small>Assets</small>
                  <b>{visibleFacilityObjects(selectedRoom.scene.objects).length}</b>
                </span>
                <span>
                  <small>Inventory</small>
                  <b>{selectedRoom.scene.inventoryItems.length}</b>
                </span>
              </div>
              <div className="facility-placement-heading">
                <span className="eyebrow">Floor assignment</span>
                <p>Choose the physical building floor. Several rooms can share the same floor.</p>
              </div>
              <label className="facility-floor-setter">
                <span>Floor assignment</span>
                <select
                  value={selectedFloor}
                  onChange={(event) => {
                    const floor = Number(event.target.value);
                    assignRoomToFloor(selectedRoom, floor);
                  }}
                >
                  {FACILITY_FLOORS.map((floor) => (
                    <option key={floor} value={floor}>
                      Floor {floor}
                    </option>
                  ))}
                </select>
              </label>
              {suggestedFloor && suggestedFloor !== selectedFloor && (
                <button
                  className="facility-floor-suggestion"
                  onClick={() => assignRoomToFloor(selectedRoom, suggestedFloor)}
                >
                  <MagicWand size={16} /> Use Floor {suggestedFloor} from “{selectedRoom.code}”
                </button>
              )}
              <details className="facility-plan-coordinates">
                <summary>Advanced plan coordinates</summary>
                <div className="facility-coordinate-grid">
                  {(["x", "y", "rotation"] as const).map((key) => (
                    <label key={key}>
                      <span>
                        {key === "rotation" ? "Rotation" : `${key.toUpperCase()} position`}
                      </span>
                      <input
                        type="number"
                        step={key === "rotation" ? 15 : 500}
                        value={roomPlacement(selectedRoom)[key]}
                        onChange={(event) =>
                          updatePlacement(selectedRoom.id, { [key]: Number(event.target.value) })
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
              <button
                className="facility-open-room"
                disabled={openingRoomId !== null}
                onClick={() => void openRoom(selectedRoom.id)}
              >
                {openingRoomId === selectedRoom.id
                  ? `Opening ${selectedRoom.code}…`
                  : "Open room editor"}{" "}
                <ArrowRight size={17} />
              </button>
            </>
          ) : null}
        </aside>
      </main>
      <Dialogs />
      <Toasts />
    </div>
  );
}
