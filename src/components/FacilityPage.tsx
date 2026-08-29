import {
  ArrowRight,
  Buildings,
  DoorOpen,
  PresentationChart,
  Ruler,
  StackSimple,
} from "@phosphor-icons/react";
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { Room, SceneObject } from "../domain/schema";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";
import { Dialogs, Toasts } from "./Dialogs";
import { TopBar } from "./TopBar";

function fallbackPlacement(index: number) {
  return { floor: index, x: 0, y: 0, rotation: 0 };
}

function metres(value: number) {
  return `${(value / 1000).toFixed(1)} m`;
}

function objectColor(object: SceneObject) {
  if (object.objectType === "storage") return "#91a6a0";
  if (object.objectType === "equipment") return "#d9e2df";
  if (object.objectType === "furniture") return "#3b4c49";
  if (object.objectType === "safety") return "#e5b960";
  if (object.objectType === "utility") return "#7fa59f";
  if (object.objectType === "door" || object.objectType === "window") return "#a9c5c0";
  return "#b8c5c2";
}

type StackRoomProps = {
  room: Room;
  stackIndex: number;
  selected: boolean;
  onSelect: (roomId: string) => void;
  onOpen: (roomId: string) => void;
};

function StackRoom({ room, stackIndex, selected, onSelect, onOpen }: StackRoomProps) {
  const width = room.width / 1000;
  const depth = room.depth / 1000;
  const levelY = stackIndex * 2.25;
  const placement = room.facilityPlacement ?? fallbackPlacement(stackIndex);
  const walls = room.scene.objects.filter((object) => object.visible && object.wall);
  const objects = room.scene.objects.filter(
    (object) =>
      object.visible &&
      object.objectType !== "wall" &&
      object.objectType !== "label" &&
      object.objectType !== "measurement",
  );

  return (
    <group
      position={[0, levelY, 0]}
      rotation={[0, THREE.MathUtils.degToRad(-placement.rotation), 0]}
    >
      <mesh
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect(room.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onOpen(room.id);
        }}
      >
        <boxGeometry args={[width + 0.28, 0.14, depth + 0.28]} />
        <meshStandardMaterial
          color={selected ? "#caeee6" : "#f5f8f7"}
          emissive={selected ? "#0a6f62" : "#000000"}
          emissiveIntensity={selected ? 0.08 : 0}
          roughness={0.78}
          metalness={0.02}
        />
      </mesh>

      {walls.map((object) => {
        const wall = object.wall!;
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.max(0.12, Math.hypot(dx, dy) / 1000);
        const x = (wall.start.x + wall.end.x) / 2000 - width / 2;
        const z = (wall.start.y + wall.end.y) / 2000 - depth / 2;
        const angle = -Math.atan2(dy, dx);
        return (
          <mesh
            key={object.id}
            position={[x, 0.42, z]}
            rotation={[0, angle, 0]}
            castShadow
            receiveShadow
            onClick={(event) => {
              event.stopPropagation();
              onSelect(room.id);
            }}
          >
            <boxGeometry args={[length, 0.76, Math.max(0.06, wall.thickness / 1000)]} />
            <meshStandardMaterial color={selected ? "#effaf7" : "#d8e0de"} roughness={0.7} />
          </mesh>
        );
      })}

      {objects.map((object) => {
        const objectWidth = Math.max(0.08, object.dimensions.width / 1000);
        const objectDepth = Math.max(0.08, object.dimensions.depth / 1000);
        const objectHeight = Math.min(0.7, Math.max(0.12, object.dimensions.height / 2400));
        return (
          <mesh
            key={object.id}
            position={[
              object.position.x / 1000 - width / 2,
              0.12 + objectHeight / 2,
              object.position.y / 1000 - depth / 2,
            ]}
            rotation={[0, THREE.MathUtils.degToRad(-object.rotation.z), 0]}
            castShadow
            receiveShadow
            onClick={(event) => {
              event.stopPropagation();
              onSelect(room.id);
            }}
          >
            <boxGeometry args={[objectWidth, objectHeight, objectDepth]} />
            <meshStandardMaterial
              color={objectColor(object)}
              roughness={object.objectType === "equipment" ? 0.38 : 0.68}
              metalness={object.objectType === "equipment" ? 0.24 : 0.04}
            />
          </mesh>
        );
      })}

      <Html
        position={[-width / 2, 1.12, -depth / 2]}
        center={false}
        zIndexRange={[40, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className={`facility-stack-label${selected ? " selected" : ""}`}>
          <small>
            LEVEL {placement.floor + 1} · {room.code}
          </small>
          <b>{room.name}</b>
          <span>
            {objects.length} assets · {room.scene.inventoryItems.length} inventory
          </span>
        </div>
      </Html>
    </group>
  );
}

type StackViewProps = {
  rooms: Room[];
  selectedRoomId: string | undefined;
  onSelect: (roomId: string) => void;
  onOpen: (roomId: string) => void;
};

function FacilityStackView({ rooms, selectedRoomId, onSelect, onOpen }: StackViewProps) {
  const maxSpan = Math.max(8, ...rooms.flatMap((room) => [room.width / 1000, room.depth / 1000]));
  const stackHeight = Math.max(2, (rooms.length - 1) * 2.25);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{
        position: [maxSpan * 1.25, stackHeight * 0.7 + 7, maxSpan * 1.35],
        fov: 42,
        near: 0.1,
        far: 180,
      }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#edf3f1"]} />
      <fog attach="fog" args={["#edf3f1", 30, 90]} />
      <ambientLight intensity={1.75} />
      <directionalLight
        castShadow
        intensity={2.2}
        position={[12, 18, 10]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight intensity={0.7} position={[-10, 8, -8]} color="#d7f2ec" />
      <gridHelper args={[80, 80, "#b8d0cb", "#dbe7e4"]} position={[0, -0.09, 0]} />
      {rooms.map((room, index) => (
        <StackRoom
          key={room.id}
          room={room}
          stackIndex={rooms.length - index - 1}
          selected={selectedRoomId === room.id}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ))}
      <OrbitControls
        makeDefault
        target={[0, stackHeight / 2, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={70}
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
        .sort((a, b) => {
          const floorDelta = (a.facilityPlacement?.floor ?? 0) - (b.facilityPlacement?.floor ?? 0);
          return floorDelta || a.name.localeCompare(b.name);
        }),
    [laboratory?.id, project.rooms],
  );
  const selectedRoom =
    laboratoryRooms.find((room) => room.id === selectedRoomId) ?? laboratoryRooms[0];

  const openRoom = (roomId: string) => {
    switchRoom(roomId);
    window.location.assign("/");
  };

  const arrangeRooms = () => {
    laboratoryRooms.forEach((room, index) =>
      updatePlacement(room.id, { floor: index, x: 0, y: 0, rotation: 0 }),
    );
    if (laboratoryRooms.length) {
      setSelectedRoomId(laboratoryRooms[0].id);
      pushToast(
        `${laboratoryRooms.length} rooms arranged into a top-to-bottom facility stack.`,
        "success",
      );
    }
  };

  return (
    <div className="app-shell facility-shell">
      <TopBar activeArea="facility" contextLabel="Facility workspace" />
      <main className="facility-workspace">
        <aside className="facility-rail">
          <div className="facility-rail-heading">
            <span className="eyebrow">Laboratory navigator</span>
            <h1>Facility stack</h1>
            <p>Review every room as one vertical spatial system, then open any level for detail.</p>
          </div>
          <label>
            <span>Laboratory</span>
            <select
              value={laboratory?.id ?? ""}
              onChange={(event) => {
                setLaboratoryId(event.target.value);
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
          <div className="facility-stack-summary">
            <StackSimple size={18} weight="duotone" />
            <span>
              <b>{laboratoryRooms.length} room layers</b>
              <small>Highest saved level shown first</small>
            </span>
          </div>
          <div className="facility-room-list" aria-label="Rooms in facility stack">
            {[...laboratoryRooms].reverse().map((room) => {
              const placement = room.facilityPlacement ?? fallbackPlacement(0);
              return (
                <button
                  key={room.id}
                  className={selectedRoom?.id === room.id ? "active" : ""}
                  onClick={() => setSelectedRoomId(room.id)}
                  onDoubleClick={() => openRoom(room.id)}
                >
                  <span className="facility-level-number">{placement.floor + 1}</span>
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
              );
            })}
          </div>
          <button className="facility-arrange" onClick={arrangeRooms}>
            <StackSimple size={17} /> Auto-stack rooms top to bottom
          </button>
          <p className="facility-arrange-note">
            Assigns one saved facility level per room and resets only facility coordinates. Room
            layouts and contents stay unchanged.
          </p>
        </aside>

        <section className="facility-map-panel facility-stack-panel">
          <header>
            <span>
              <small>Shared three-dimensional facility frame</small>
              <b>{laboratory?.name}</b>
            </span>
            <em>Orbit · pan · zoom · double-click a room to open</em>
          </header>
          <div
            className="facility-map facility-stack-canvas"
            aria-label="Three-dimensional facility room stack"
          >
            {laboratoryRooms.length ? (
              <FacilityStackView
                rooms={laboratoryRooms}
                selectedRoomId={selectedRoom?.id}
                onSelect={setSelectedRoomId}
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
                <i className="selected" /> Selected room
              </span>
              <span>
                <i /> Saved level
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
                    LEVEL {(selectedRoom.facilityPlacement?.floor ?? 0) + 1} · {selectedRoom.code}
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
                  <b>
                    {
                      selectedRoom.scene.objects.filter((object) => object.objectType !== "wall")
                        .length
                    }
                  </b>
                </span>
                <span>
                  <small>Inventory</small>
                  <b>{selectedRoom.scene.inventoryItems.length}</b>
                </span>
              </div>
              <div className="facility-placement-heading">
                <span className="eyebrow">Spatial assignment</span>
                <p>
                  Level controls the vertical order. X, Y, and rotation preserve future campus-plan
                  coordinates.
                </p>
              </div>
              <div className="facility-coordinate-grid">
                {(["x", "y", "rotation"] as const).map((key) => (
                  <label key={key}>
                    <span>{key === "rotation" ? "Rotation" : `${key.toUpperCase()} position`}</span>
                    <input
                      type="number"
                      step={key === "rotation" ? 15 : 500}
                      value={
                        (selectedRoom.facilityPlacement ??
                          fallbackPlacement(laboratoryRooms.indexOf(selectedRoom)))[key]
                      }
                      onChange={(event) =>
                        updatePlacement(selectedRoom.id, { [key]: Number(event.target.value) })
                      }
                    />
                  </label>
                ))}
                <label>
                  <span>Facility level</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={
                      (
                        selectedRoom.facilityPlacement ??
                        fallbackPlacement(laboratoryRooms.indexOf(selectedRoom))
                      ).floor
                    }
                    onChange={(event) =>
                      updatePlacement(selectedRoom.id, { floor: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <button className="facility-open-room" onClick={() => openRoom(selectedRoom.id)}>
                Open room editor <ArrowRight size={17} />
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
