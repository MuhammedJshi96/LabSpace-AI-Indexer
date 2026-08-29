import {
  ArrowRight,
  Buildings,
  DoorOpen,
  GridFour,
  PresentationChart,
  Ruler,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";
import { Dialogs, Toasts } from "./Dialogs";
import { TopBar } from "./TopBar";

function fallbackPlacement(index: number) {
  return { floor: 0, x: (index % 3) * 13_000, y: Math.floor(index / 3) * 11_000, rotation: 0 };
}

function metres(value: number) {
  return `${(value / 1000).toFixed(1)} m`;
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
  const [laboratoryId, setLaboratoryId] = useState(activeRoom.laboratoryId);
  const [floor, setFloor] = useState(activeRoom.facilityPlacement?.floor ?? 0);
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
      project.rooms.filter(
        (room) => room.laboratoryId === laboratory?.id && room.roomKind !== "demo-template",
      ),
    [laboratory?.id, project.rooms],
  );
  const floorRooms = laboratoryRooms.filter(
    (room, index) => (room.facilityPlacement ?? fallbackPlacement(index)).floor === floor,
  );
  const selectedRoom =
    laboratoryRooms.find((room) => room.id === selectedRoomId) ?? floorRooms[0] ?? laboratoryRooms[0];
  const floors = Array.from(
    new Set(laboratoryRooms.map((room, index) => (room.facilityPlacement ?? fallbackPlacement(index)).floor)),
  ).sort((a, b) => a - b);

  const mapBounds = useMemo(() => {
    const boxes = floorRooms.map((room, index) => {
      const placement = room.facilityPlacement ?? fallbackPlacement(index);
      return {
        left: placement.x,
        top: placement.y,
        right: placement.x + room.width,
        bottom: placement.y + room.depth,
      };
    });
    if (!boxes.length) return { x: -1000, y: -1000, width: 14_000, height: 10_000 };
    const minX = Math.min(...boxes.map((box) => box.left)) - 1500;
    const minY = Math.min(...boxes.map((box) => box.top)) - 1500;
    const maxX = Math.max(...boxes.map((box) => box.right)) + 1500;
    const maxY = Math.max(...boxes.map((box) => box.bottom)) + 1500;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [floorRooms]);

  const arrangeRooms = () => {
    floorRooms.forEach((room, index) =>
      updatePlacement(room.id, { ...fallbackPlacement(index), floor }),
    );
  };

  return (
    <div className="app-shell facility-shell">
      <TopBar activeArea="facility" contextLabel="Facility layout" />
      <main className="facility-workspace">
        <aside className="facility-rail">
          <div className="facility-rail-heading">
            <span className="eyebrow">Laboratory navigator</span>
            <h1>Facility workspace</h1>
            <p>Position rooms together while every room keeps its own detailed editor scene.</p>
          </div>
          <label>
            <span>Laboratory</span>
            <select
              value={laboratory?.id ?? ""}
              onChange={(event) => {
                setLaboratoryId(event.target.value);
                const next = project.rooms.find(
                  (room) => room.laboratoryId === event.target.value && room.roomKind !== "demo-template",
                );
                if (next) {
                  setSelectedRoomId(next.id);
                  setFloor(next.facilityPlacement?.floor ?? 0);
                }
              }}
            >
              {project.laboratories.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name} · {entry.code}</option>
              ))}
            </select>
          </label>
          <div className="facility-floor-tabs" role="tablist" aria-label="Facility floors">
            {(floors.length ? floors : [0]).map((entry) => (
              <button
                key={entry}
                role="tab"
                aria-selected={floor === entry}
                className={floor === entry ? "active" : ""}
                onClick={() => setFloor(entry)}
              >
                Level {entry + 1}
              </button>
            ))}
          </div>
          <div className="facility-room-list">
            {floorRooms.map((room) => (
              <button
                key={room.id}
                className={selectedRoom?.id === room.id ? "active" : ""}
                onClick={() => setSelectedRoomId(room.id)}
              >
                {room.roomKind === "demo" ? <PresentationChart size={17} /> : <DoorOpen size={17} />}
                <span>
                  <b>{room.name}</b>
                  <small>{room.code} · {room.scene.inventoryItems.length} inventory</small>
                </span>
              </button>
            ))}
          </div>
          <button className="facility-arrange" onClick={arrangeRooms}>
            <GridFour size={16} /> Arrange rooms on this level
          </button>
        </aside>

        <section className="facility-map-panel">
          <header>
            <span>
              <small>Shared spatial frame</small>
              <b>{laboratory?.name} · Level {floor + 1}</b>
            </span>
            <em>{floorRooms.length} room{floorRooms.length === 1 ? "" : "s"}</em>
          </header>
          <div className="facility-map" aria-label="Facility room map">
            <svg viewBox={`${mapBounds.x} ${mapBounds.y} ${mapBounds.width} ${mapBounds.height}`}>
              <defs>
                <pattern id="facility-grid" width="1000" height="1000" patternUnits="userSpaceOnUse">
                  <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#d9e5e2" strokeWidth="18" />
                </pattern>
              </defs>
              <rect x={mapBounds.x} y={mapBounds.y} width={mapBounds.width} height={mapBounds.height} fill="url(#facility-grid)" />
              {floorRooms.map((room, index) => {
                const placement = room.facilityPlacement ?? fallbackPlacement(index);
                const selected = selectedRoom?.id === room.id;
                const nonWallObjects = room.scene.objects.filter((object) => object.objectType !== "wall");
                return (
                  <g
                    key={room.id}
                    transform={`translate(${placement.x} ${placement.y}) rotate(${placement.rotation} ${room.width / 2} ${room.depth / 2})`}
                    className={`facility-room-shape${selected ? " selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRoomId(room.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedRoomId(room.id);
                      }
                    }}
                    onDoubleClick={() => {
                      switchRoom(room.id);
                      window.location.assign("/");
                    }}
                  >
                    <rect width={room.width} height={room.depth} rx="180" />
                    <text x="500" y="800" className="facility-room-code">{room.code}</text>
                    <text x="500" y="1450" className="facility-room-name">{room.name}</text>
                    <text x="500" y={room.depth - 550} className="facility-room-meta">
                      {nonWallObjects.length} assets · {room.scene.inventoryItems.length} items
                    </text>
                  </g>
                );
              })}
            </svg>
            {!floorRooms.length && (
              <div className="facility-map-empty">
                <Buildings size={34} />
                <b>No rooms on this level</b>
                <span>Move a room here from its facility coordinates.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="facility-inspector">
          {selectedRoom ? (
            <>
              <div className="facility-inspector-title">
                <span className="facility-room-symbol"><Ruler size={20} /></span>
                <span>
                  <small>{selectedRoom.code}</small>
                  <h2>{selectedRoom.name}</h2>
                </span>
              </div>
              <div className="facility-stat-grid">
                <span><small>Width</small><b>{metres(selectedRoom.width)}</b></span>
                <span><small>Depth</small><b>{metres(selectedRoom.depth)}</b></span>
                <span><small>Assets</small><b>{selectedRoom.scene.objects.filter((object) => object.objectType !== "wall").length}</b></span>
                <span><small>Inventory</small><b>{selectedRoom.scene.inventoryItems.length}</b></span>
              </div>
              <div className="facility-coordinate-grid">
                {(["x", "y", "rotation"] as const).map((key) => (
                  <label key={key}>
                    <span>{key === "rotation" ? "Rotation" : `${key.toUpperCase()} position`}</span>
                    <input
                      type="number"
                      step={key === "rotation" ? 15 : 500}
                      value={(selectedRoom.facilityPlacement ?? fallbackPlacement(laboratoryRooms.indexOf(selectedRoom)))[key]}
                      onChange={(event) => updatePlacement(selectedRoom.id, { [key]: Number(event.target.value) })}
                    />
                  </label>
                ))}
                <label>
                  <span>Level</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={(selectedRoom.facilityPlacement ?? fallbackPlacement(laboratoryRooms.indexOf(selectedRoom))).floor}
                    onChange={(event) => updatePlacement(selectedRoom.id, { floor: Number(event.target.value) })}
                  />
                </label>
              </div>
              <button
                className="facility-open-room"
                onClick={() => {
                  switchRoom(selectedRoom.id);
                  window.location.assign("/");
                }}
              >
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
