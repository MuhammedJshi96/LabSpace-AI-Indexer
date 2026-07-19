import { useMemo, useState, type CSSProperties } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CaretLeft,
  CaretRight,
  Cube,
  Eye,
  EyeSlash,
  Info,
  Stack,
  LockSimple,
  LockSimpleOpen,
  MagnifyingGlass,
  MapPin,
  Package,
  Plus,
  Printer,
  Selection,
  Trash,
  TreeStructure,
  Warning,
} from "@phosphor-icons/react";
import { getAssetDefinition } from "../domain/assets";
import { validatePlacement } from "../domain/geometry";
import { getLocationPath, indexingStats } from "../domain/indexing";
import { LABORATORY_ENVIRONMENT_PROFILES } from "../domain/laboratory-environment";
import {
  findLaboratoryFloorFinish,
  LABORATORY_FLOOR_FINISHES,
  laboratoryFloorFinishLabel,
} from "../domain/laboratory-materials";
import {
  findLaboratoryWallFinish,
  LABORATORY_WALL_FINISHES,
  wallFinishForObject,
} from "../domain/laboratory-wall-materials";
import { normalizeRaisedFromFloorMm } from "../domain/object-transforms";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import type {
  EquipmentRecord,
  SceneObject,
  StorageLocation,
  StorageLocationType,
} from "../domain/schema";
import { selectActiveRoom, useEditorStore, type InspectorPanel } from "../store/editor-store";

const panelTabs: Array<{ id: InspectorPanel; label: string; icon: typeof Info }> = [
  { id: "room", label: "Room", icon: Info },
  { id: "layers", label: "Layers", icon: Stack },
  { id: "index", label: "Storage", icon: TreeStructure },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "properties", label: "Details", icon: Selection },
  { id: "validation", label: "Issues", icon: Warning },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="info-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  suffix,
  multiline = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  suffix?: string;
  multiline?: boolean;
}) {
  return (
    <label className="property-field">
      <span>{label}</span>
      <div className="input-with-suffix">
        {multiline ? (
          <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
        ) : (
          <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
        )}
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

type SurfaceMaterialChoice = {
  id: string;
  label: string;
  description: string;
  color: string;
  accent: string;
  pattern?: string;
};

function SurfaceMaterialPicker({
  label,
  value,
  choices,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  choices: readonly SurfaceMaterialChoice[];
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const selectedChoice = choices.find((choice) => choice.id === value);
  return (
    <div className={`surface-material-group ${compact ? "is-compact" : ""}`}>
      <div className="surface-material-heading">
        <span>{label}</span>
        <em>{selectedChoice?.label ?? "Custom"}</em>
      </div>
      {compact && selectedChoice && (
        <p className="surface-material-description">{selectedChoice.description}</p>
      )}
      <div className="surface-material-grid" role="list" aria-label={`${label} material library`}>
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={`surface-material-card ${choice.id === value ? "active" : ""}`}
            aria-pressed={choice.id === value}
            onClick={() => onChange(choice.id)}
            title={choice.description}
          >
            <i
              className={choice.pattern ? `pattern-${choice.pattern}` : ""}
              style={
                {
                  "--surface-color": choice.color,
                  "--surface-accent": choice.accent,
                } as CSSProperties
              }
            />
            <span>
              <b>{choice.label}</b>
              {!compact && <small>{choice.description}</small>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomPanel() {
  const room = useEditorStore(selectActiveRoom);
  const updateRoom = useEditorStore((state) => state.updateRoom);
  const stats = indexingStats(room.scene);
  const closedFloor = getClosedWallFloorPolygon(room.scene.objects);
  const registeredFloorFinish = findLaboratoryFloorFinish(room.floorFinish);
  const registeredWallFinish = findLaboratoryWallFinish(room.wallFinish);
  const utilityCount = room.scene.objects.filter(
    (object) => object.objectType === "utility",
  ).length;
  const [surfaceTarget, setSurfaceTarget] = useState<"floor" | "walls">("floor");
  const floorChoices = LABORATORY_FLOOR_FINISHES.map((finish) => ({
    id: finish.id,
    label: finish.label,
    description: finish.description,
    color: finish.planColor,
    accent: finish.patternColor,
    pattern: finish.pattern,
  }));
  const wallChoices = LABORATORY_WALL_FINISHES.map((finish) => ({
    id: finish.id,
    label: finish.label,
    description: finish.description,
    color: finish.color,
    accent: finish.baseboardColor,
  }));
  return (
    <div className="inspector-scroll">
      <section className="inspector-section room-summary">
        <div className="room-code-mark">
          <Cube size={28} weight="duotone" />
          <span>
            <b>
              {room.name} <em>{room.code}</em>
            </b>
            {laboratoryFloorFinishLabel(room.floorFinish)} floor
          </span>
        </div>
        <div className="stat-grid">
          <Stat
            label="Floor area"
            value={`${((closedFloor?.areaMm2 ?? 0) / 1_000_000).toFixed(2)} m²`}
          />
          <Stat
            label="Perimeter"
            value={`${((closedFloor?.perimeterMm ?? 0) / 1000).toFixed(2)} m`}
          />
          <Stat label="Wall height" value={`${(room.wallHeight / 1000).toFixed(2)} m`} />
          <Stat label="Equipment" value={stats.equipment} />
          <Stat label="Utilities" value={utilityCount} />
          <Stat label="Occupancy" value={0} />
        </div>
      </section>
      <section className="inspector-section">
        <h3>Room information</h3>
        <TextField label="Room name" value={room.name} onChange={(name) => updateRoom({ name })} />
        <TextField
          label="Room code"
          value={room.code}
          onChange={(code) => updateRoom({ code: code.toUpperCase() })}
        />
        <TextField
          label="Description"
          value={room.notes}
          multiline
          onChange={(notes) => updateRoom({ notes })}
        />
        <label className="property-field">
          <span>3D ceiling &amp; services</span>
          <div className="input-with-suffix">
            <select
              value={room.environmentProfileId ?? ""}
              onChange={(event) => updateRoom({ environmentProfileId: event.target.value || null })}
              aria-label="3D ceiling and services profile"
            >
              <option value="">None</option>
              {Object.values(LABORATORY_ENVIRONMENT_PROFILES).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
        </label>
        <div className="room-update-row">
          <span>Last updated: {new Date(room.updatedAt).toLocaleString()}</span>
          <a href={`/digital-twin?room=${encodeURIComponent(room.id)}`}>View in Spatial Index</a>
        </div>
      </section>
      <section className="inspector-section surface-library-section">
        <div className="surface-library-header">
          <span>
            <span className="eyebrow">Predefined library</span>
            <h3>Room surface materials</h3>
          </span>
          <div className="surface-target-tabs" role="tablist" aria-label="Surface type">
            <button
              role="tab"
              aria-selected={surfaceTarget === "floor"}
              className={surfaceTarget === "floor" ? "active" : ""}
              onClick={() => setSurfaceTarget("floor")}
            >
              Floor
            </button>
            <button
              role="tab"
              aria-selected={surfaceTarget === "walls"}
              className={surfaceTarget === "walls" ? "active" : ""}
              onClick={() => setSurfaceTarget("walls")}
            >
              Walls
            </button>
          </div>
        </div>
        {surfaceTarget === "floor" ? (
          <SurfaceMaterialPicker
            label="Floor finish"
            value={registeredFloorFinish?.id ?? room.floorFinish}
            choices={floorChoices}
            compact
            onChange={(floorFinish) => updateRoom({ floorFinish })}
          />
        ) : (
          <SurfaceMaterialPicker
            label="Wall finish"
            value={registeredWallFinish?.id ?? room.wallFinish}
            choices={wallChoices}
            compact
            onChange={(wallFinish) => updateRoom({ wallFinish })}
          />
        )}
      </section>
    </div>
  );
}

function LayersPanel() {
  const room = useEditorStore(selectActiveRoom);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const toggleLayer = useEditorStore((state) => state.toggleLayer);
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const updateObject = useEditorStore((state) => state.updateObject);
  const addLayer = useEditorStore((state) => state.addLayer);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const layers = [...room.scene.layers].sort((a, b) => a.order - b.order);
  const move = (index: number, direction: -1 | 1) => {
    const other = layers[index + direction];
    const current = layers[index];
    if (!other) return;
    updateLayer(current.id, { order: other.order });
    updateLayer(other.id, { order: current.order });
  };
  return (
    <div className="inspector-scroll">
      <section className="inspector-section layer-controls">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Scene organization</span>
            <h3>{layers.length} layers</h3>
          </div>
          <button className="small-primary" onClick={addLayer}>
            <Plus size={15} />
            Add layer
          </button>
        </div>
        <div className="layer-list">
          {layers.map((layer, index) => {
            const count = room.scene.objects.filter((object) => object.layerId === layer.id).length;
            return (
              <div className={`layer-row ${!layer.visible ? "muted" : ""}`} key={layer.id}>
                <i style={{ background: layer.color }} />
                <input
                  value={layer.name}
                  onChange={(event) => updateLayer(layer.id, { name: event.target.value })}
                  aria-label={`Rename ${layer.name}`}
                />
                <span>{count}</span>
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  title="Move layer up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === layers.length - 1}
                  title="Move layer down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() => toggleLayer(layer.id, "locked")}
                  title={layer.locked ? "Unlock layer" : "Lock layer"}
                >
                  {layer.locked ? (
                    <LockSimple size={15} weight="fill" />
                  ) : (
                    <LockSimpleOpen size={15} />
                  )}
                </button>
                <button
                  onClick={() => toggleLayer(layer.id, "visible")}
                  title={layer.visible ? "Hide layer" : "Show layer"}
                >
                  {layer.visible ? <Eye size={16} /> : <EyeSlash size={16} />}
                </button>
                {!layer.system && (
                  <button
                    className="danger-icon"
                    onClick={() => deleteLayer(layer.id)}
                    title="Delete custom layer"
                  >
                    <Trash size={15} />
                  </button>
                )}
                {selectedIds.length > 0 && (
                  <button
                    className="assign-layer"
                    onClick={() =>
                      selectedIds.forEach((id) =>
                        updateObject(id, { layerId: layer.id }, `Assign ${layer.name}`),
                      )
                    }
                  >
                    Assign
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LocationNode({
  location,
  locations,
  occupied,
}: {
  location: StorageLocation;
  locations: StorageLocation[];
  occupied: Set<string>;
}) {
  const [open, setOpen] = useState(true);
  const selectedId = useEditorStore((state) => state.selectedLocationId);
  const setSelectedLocation = useEditorStore((state) => state.setSelectedLocation);
  const children = locations
    .filter((entry) => entry.parentId === location.id)
    .sort((a, b) => a.order - b.order);
  const Icon = location.type === "cabinet" ? Archive : location.type === "bin" ? Package : MapPin;
  return (
    <div className="location-node">
      <button
        className={`location-row ${selectedId === location.id ? "selected" : ""}`}
        title={`${location.name} — ${location.indexCode}`}
        onClick={() => setSelectedLocation(location.id)}
      >
        <span
          className="tree-toggle"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(!open);
          }}
        >
          <CaretRight size={13} className={open ? "open" : ""} />
        </span>
        <Icon size={16} weight={location.type === "cabinet" ? "duotone" : "regular"} />
        <span>
          <b>{location.name}</b>
          <em>{location.indexCode}</em>
        </span>
        <i
          className={occupied.has(location.id) ? "occupied" : "empty"}
          title={occupied.has(location.id) ? "Occupied" : "Empty"}
        />
      </button>
      {open && children.length > 0 && (
        <div className="location-children">
          {children.map((child) => (
            <LocationNode
              key={child.id}
              location={child}
              locations={locations}
              occupied={occupied}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const childOptions: Record<StorageLocationType, StorageLocationType[]> = {
  cabinet: ["compartment", "shelf", "drawer"],
  compartment: ["shelf", "bin"],
  shelf: ["bin"],
  drawer: ["bin"],
  bin: [],
};

function IndexPanel() {
  const room = useEditorStore(selectActiveRoom);
  const selectedLocationId = useEditorStore((state) => state.selectedLocationId);
  const setDialog = useEditorStore((state) => state.setDialog);
  const addChild = useEditorStore((state) => state.addStorageChild);
  const removeLocation = useEditorStore((state) => state.removeStorageLocation);
  const updateLocation = useEditorStore((state) => state.updateStorageLocation);
  const addInventory = useEditorStore((state) => state.addInventoryItem);
  const presentation = useEditorStore((state) => state.presentation);
  const setPresentation = useEditorStore((state) => state.setPresentation);
  const filter = useEditorStore((state) => state.indexFilter);
  const setFilter = useEditorStore((state) => state.setIndexFilter);
  const [search, setSearch] = useState("");
  const occupied = useMemo(
    () =>
      new Set(
        room.scene.inventoryItems
          .map((item) => item.storageLocationId)
          .filter((id): id is string => Boolean(id)),
      ),
    [room.scene.inventoryItems],
  );
  const selected = room.scene.storageLocations.find(
    (location) => location.id === selectedLocationId,
  );
  const path = selected ? getLocationPath(room.scene, selected.id) : [];
  const roots = room.scene.storageLocations.filter(
    (location) =>
      !location.parentId &&
      (!search ||
        location.name.toLowerCase().includes(search.toLowerCase()) ||
        location.indexCode.toLowerCase().includes(search.toLowerCase())),
  );
  const filteredRoots = roots.filter((root) => {
    if (filter === "all") return true;
    const related = room.scene.storageLocations.filter(
      (location) => location.objectId === root.objectId,
    );
    if (filter === "occupied") return related.some((location) => occupied.has(location.id));
    if (filter === "empty")
      return related.some((location) => !occupied.has(location.id) && location.type !== "cabinet");
    return false;
  });
  const contents = selected
    ? room.scene.inventoryItems.filter((item) => item.storageLocationId === selected.id)
    : [];
  const stats = indexingStats(room.scene);
  if (!room.scene.storageLocations.length && !room.scene.inventoryItems.length) {
    return (
      <div className="index-panel-empty">
        <span className="index-panel-empty-icon">
          <TreeStructure size={29} weight="duotone" />
        </span>
        <b>No indexed storage yet</b>
        <span>
          Add a cabinet, shelf, drawer, or bin to create the room's exact Spatial Index evidence
          trail.
        </span>
        <button onClick={() => setPresentation("2d")}>Return to the layout</button>
      </div>
    );
  }
  return (
    <div className="inspector-scroll index-inspector">
      <section className="inspector-section index-overview">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Spatial storage index</span>
            <h3>{stats.totalLocations} exact locations</h3>
          </div>
          <span className="index-health-badge">
            {stats.unassignedItems ? `${stats.unassignedItems} unassigned` : "Fully assigned"}
          </span>
        </div>
        <label className="search-field">
          <MagnifyingGlass size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search codes or contents…"
          />
        </label>
        <div className="filter-chips">
          {(["all", "occupied", "empty", "unassigned"] as const).map((value) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
              {value === "unassigned" && stats.unassignedItems ? ` ${stats.unassignedItems}` : ""}
            </button>
          ))}
        </div>
        <div className="index-overview-metrics">
          <Stat label="Locations" value={stats.totalLocations} />
          <Stat label="Occupied" value={stats.occupiedLocations} />
          <Stat label="Available" value={stats.emptyLocations} />
        </div>
      </section>
      <div className="index-workspace">
        <section className="inspector-section index-browser-section">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Room hierarchy</span>
              <h3>
                {filter === "unassigned" ? "Items needing a location" : "Cabinets and compartments"}
              </h3>
            </div>
            <span className="index-result-count">
              {filter === "unassigned"
                ? room.scene.inventoryItems.filter((item) => !item.storageLocationId).length
                : filteredRoots.length}
            </span>
          </div>
          <div className="location-tree">
            {filter === "unassigned"
              ? room.scene.inventoryItems
                  .filter((item) => !item.storageLocationId)
                  .map((item) => (
                    <button
                      className="unassigned-row"
                      key={item.id}
                      onClick={() => setDialog("inventory")}
                    >
                      <Package size={16} />
                      <span>
                        <b>{item.name}</b>
                        <em>
                          {item.quantity} {item.unit}
                        </em>
                      </span>
                    </button>
                  ))
              : filteredRoots.map((root) => (
                  <LocationNode
                    key={root.id}
                    location={root}
                    locations={room.scene.storageLocations}
                    occupied={occupied}
                  />
                ))}
            {filter !== "unassigned" && !filteredRoots.length && (
              <div className="empty-state compact">
                <TreeStructure size={24} />
                <b>No matching locations</b>
                <span>Adjust the index filter.</span>
              </div>
            )}
          </div>
        </section>
        <section className="inspector-section index-detail-section">
          {selected ? (
            <>
              <div className="index-location-header">
                <span className="index-location-icon">
                  <Archive size={22} weight="duotone" />
                </span>
                <span>
                  <span className="eyebrow">{selected.type}</span>
                  <h3>{selected.name}</h3>
                  <code>{selected.indexCode}</code>
                </span>
                <em className={occupied.has(selected.id) ? "is-occupied" : "is-empty"}>
                  {occupied.has(selected.id) ? "Occupied" : "Available"}
                </em>
              </div>
              <div className="location-trace">
                {path.map((item, index) => (
                  <span key={item.id}>
                    {index > 0 && <CaretRight size={12} />}
                    {item.name}
                  </span>
                ))}
              </div>
              <div className="property-grid two">
                <TextField
                  label="Location name"
                  value={selected.name}
                  onChange={(name) => updateLocation(selected.id, { name })}
                />
                <TextField
                  label="Index code"
                  value={selected.indexCode}
                  onChange={(indexCode) =>
                    updateLocation(selected.id, { indexCode: indexCode.toUpperCase() })
                  }
                />
              </div>
              <TextField
                label="Capacity notes"
                value={selected.capacityNotes}
                multiline
                onChange={(capacityNotes) => updateLocation(selected.id, { capacityNotes })}
              />
              <div className="section-heading-row tight">
                <span>
                  <span className="eyebrow">Assigned inventory</span>
                  <h3>{contents.length} items in this location</h3>
                </span>
                <button className="small-primary" onClick={() => addInventory(selected.id)}>
                  <Plus size={14} />
                  Add item
                </button>
              </div>
              <div className="contents-list">
                {contents.map((item) => (
                  <button key={item.id} onClick={() => setDialog("inventory")}>
                    <Package size={16} />
                    <span>
                      <b>{item.name}</b>
                      {item.quantity} {item.unit}
                    </span>
                  </button>
                ))}
                {!contents.length && <p>No inventory assigned to this exact location.</p>}
              </div>
              {childOptions[selected.type].length > 0 && (
                <div className="add-child-row">
                  <span>Add a nested location</span>
                  {childOptions[selected.type].map((type) => (
                    <button key={type} onClick={() => addChild(selected.id, type)}>
                      <Plus size={13} />
                      {type}
                    </button>
                  ))}
                </div>
              )}
              <div className="index-actions">
                <button onClick={() => setPresentation(presentation === "2d" ? "3d" : "2d")}>
                  <Cube size={15} />
                  Highlight in {presentation === "2d" ? "3D" : "2D"}
                </button>
                <button onClick={() => setDialog("labels")}>
                  <Printer size={15} />
                  Print label
                </button>
                <button onClick={() => setDialog("reindex")}>
                  <TreeStructure size={15} />
                  Reindex
                </button>
                {selected.parentId && (
                  <button className="danger" onClick={() => removeLocation(selected.id)}>
                    <Trash size={15} />
                    Remove
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="index-detail-empty">
              <span>
                <TreeStructure size={26} weight="duotone" />
              </span>
              <div>
                <b>Select a storage location</b>
                <p>
                  Choose a cabinet, shelf, drawer, or bin above to edit its identity and contents.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InventoryPanel() {
  const room = useEditorStore(selectActiveRoom);
  const addInventoryItem = useEditorStore((state) => state.addInventoryItem);
  const updateInventoryItem = useEditorStore((state) => state.updateInventoryItem);
  const removeInventoryItem = useEditorStore((state) => state.removeInventoryItem);
  const setDialog = useEditorStore((state) => state.setDialog);
  const setPanel = useEditorStore((state) => state.setPanel);
  const setSelectedLocation = useEditorStore((state) => state.setSelectedLocation);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "assigned" | "unassigned">("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const locationById = useMemo(
    () => new Map(room.scene.storageLocations.map((location) => [location.id, location])),
    [room.scene.storageLocations],
  );
  const assignmentLabel = (locationId: string | null) => {
    if (!locationId) return "Unassigned";
    const location = locationById.get(locationId);
    if (!location) return "Unknown location";
    return getLocationPath(room.scene, location.id)
      .map((entry) => entry.name)
      .join(" / ");
  };
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const items = room.scene.inventoryItems.filter((item) => {
    if (scope === "assigned" && !item.storageLocationId) return false;
    if (scope === "unassigned" && item.storageLocationId) return false;
    if (!normalizedSearch) return true;
    return [item.name, item.owner, item.notes, assignmentLabel(item.storageLocationId)]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedSearch);
  });
  const assignedCount = room.scene.inventoryItems.filter((item) => item.storageLocationId).length;

  const createInventoryItem = () => {
    const previousIds = new Set(room.scene.inventoryItems.map((item) => item.id));
    addInventoryItem(null);
    const createdItem = selectActiveRoom(useEditorStore.getState()).scene.inventoryItems.find(
      (item) => !previousIds.has(item.id),
    );
    setSelectedItemId(createdItem?.id ?? null);
    setDialog(null);
  };

  const selectInventoryItem = (itemId: string) => {
    setSelectedItemId(itemId);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-inventory-record-id="${itemId}"]`)
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
    });
  };

  return (
    <div className="inspector-scroll inventory-inspector">
      <section className="inspector-section inventory-overview">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Exact room inventory</span>
            <h3>{room.scene.inventoryItems.length} indexed items</h3>
          </div>
          <button className="small-primary" onClick={createInventoryItem}>
            <Plus size={15} />
            Add item
          </button>
        </div>
        <div className="inventory-metrics" aria-label="Inventory assignment status">
          <Stat label="Assigned" value={assignedCount} />
          <Stat label="Unassigned" value={room.scene.inventoryItems.length - assignedCount} />
          <Stat label="Locations" value={room.scene.storageLocations.length} />
        </div>
        <label className="search-field inventory-search">
          <MagnifyingGlass size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search items, owners, or locations…"
            aria-label="Search room inventory"
          />
        </label>
        <div className="filter-chips inventory-filter-chips">
          {(["all", "assigned", "unassigned"] as const).map((value) => (
            <button
              key={value}
              className={scope === value ? "active" : ""}
              onClick={() => setScope(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </section>
      <section className="inspector-section inventory-editor-list" aria-label="Inventory items">
        {items.map((item) => (
          <article
            className={`inventory-editor-card ${selectedItemId === item.id ? "active" : ""}`}
            key={item.id}
            data-inventory-record-id={item.id}
            onClick={() => selectInventoryItem(item.id)}
            onPointerDown={() => {
              if (selectedItemId !== item.id) selectInventoryItem(item.id);
            }}
            onFocusCapture={() => {
              if (selectedItemId !== item.id) selectInventoryItem(item.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectInventoryItem(item.id);
              }
            }}
            tabIndex={0}
          >
            <div className="inventory-editor-card-heading">
              <span className="inventory-record-icon">
                <Package size={18} weight="duotone" />
              </span>
              <label>
                <span>Item name</span>
                <input
                  value={item.name}
                  onClick={() => selectInventoryItem(item.id)}
                  onFocus={() => selectInventoryItem(item.id)}
                  onChange={(event) => updateInventoryItem(item.id, { name: event.target.value })}
                />
              </label>
              <button
                className="danger-icon"
                title={`Delete ${item.name}`}
                aria-label={`Delete ${item.name}`}
                onClick={() => {
                  if (window.confirm(`Delete ${item.name} from this room's inventory?`)) {
                    removeInventoryItem(item.id);
                    setSelectedItemId((selectedId) => (selectedId === item.id ? null : selectedId));
                  }
                }}
              >
                <Trash size={15} />
              </button>
            </div>
            <div className="inventory-editor-fields">
              <label>
                <span>Quantity</span>
                <input
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(event) =>
                    updateInventoryItem(item.id, { quantity: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Unit</span>
                <input
                  value={item.unit}
                  onChange={(event) => updateInventoryItem(item.id, { unit: event.target.value })}
                />
              </label>
              <label className="inventory-owner-field">
                <span>Owner</span>
                <input
                  value={item.owner}
                  placeholder="Shared"
                  onChange={(event) => updateInventoryItem(item.id, { owner: event.target.value })}
                />
              </label>
            </div>
            <label className="inventory-location-field">
              <span>Exact storage location</span>
              <select
                value={item.storageLocationId ?? ""}
                onChange={(event) =>
                  updateInventoryItem(item.id, {
                    storageLocationId: event.target.value || null,
                  })
                }
              >
                <option value="">Unassigned</option>
                {room.scene.storageLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {assignmentLabel(location.id)} · {location.indexCode}
                  </option>
                ))}
              </select>
            </label>
            <div className="inventory-assignment-evidence">
              <span className={item.storageLocationId ? "assigned" : "unassigned"}>
                {item.storageLocationId ? "Assigned" : "Needs location"}
              </span>
              {item.storageLocationId && (
                <button
                  onClick={() => {
                    setSelectedLocation(item.storageLocationId);
                    setPanel("index");
                  }}
                >
                  Show storage path
                </button>
              )}
            </div>
          </article>
        ))}
        {!items.length && (
          <div className="empty-state compact inventory-empty-state">
            <Package size={25} weight="duotone" />
            <b>No matching inventory</b>
            <span>Adjust the filter or add an item for this room.</span>
          </div>
        )}
      </section>
    </div>
  );
}

function ObjectProperties({ object }: { object: SceneObject }) {
  const room = useEditorStore(selectActiveRoom);
  const updateObject = useEditorStore((state) => state.updateObject);
  const duplicate = useEditorStore((state) => state.duplicateSelected);
  const remove = useEditorStore((state) => state.deleteSelected);
  const setSelectedLocation = useEditorStore((state) => state.setSelectedLocation);
  const initializeStorageForObject = useEditorStore((state) => state.initializeStorageForObject);
  const addChild = useEditorStore((state) => state.addStorageChild);
  const definition = getAssetDefinition(object.assetDefinitionId);
  const root = room.scene.storageLocations.find(
    (location) => location.objectId === object.id && !location.parentId,
  );
  const descendants = room.scene.storageLocations.filter(
    (location) => location.objectId === object.id && location.id !== root?.id,
  );
  const record = room.scene.equipmentRecords.find((entry) => entry.objectId === object.id);
  const updateRecord = useEditorStore((state) => state.updateEquipmentRecord);
  const maximumZ = Math.max(0, ...room.scene.objects.map((entry) => entry.zIndex));
  const minimumZ = Math.min(0, ...room.scene.objects.map((entry) => entry.zIndex));
  const isHostedOpening = Boolean(object.opening);
  const hostedWall = object.opening
    ? room.scene.objects.find((entry) => entry.id === object.opening?.wallId && entry.wall)
    : undefined;
  const supportsFreeTransform = !["wall", "door", "window"].includes(object.objectType);
  const objectWallFinish = object.wall
    ? wallFinishForObject(object.metadata, room.wallFinish)
    : null;
  const setNumber = (group: "position" | "dimensions" | "rotation", key: string, value: string) => {
    const current = object[group] as Record<string, number>;
    updateObject(object.id, { [group]: { ...current, [key]: Number(value) } }, `Edit ${key}`);
  };
  return (
    <div className="inspector-scroll object-properties-panel">
      <section className="inspector-section selected-summary property-hero">
        <div className="selected-preview">
          <Cube size={28} weight="duotone" />
        </div>
        <div>
          <span className="eyebrow">{object.objectType}</span>
          <h3>{object.name}</h3>
          <code>{object.indexCode}</code>
          <span className="property-hero-meta">
            <em>{definition.category}</em>
            <em>
              {Math.round(object.dimensions.width)} × {Math.round(object.dimensions.depth)} ×{" "}
              {Math.round(object.dimensions.height)} mm
            </em>
          </span>
        </div>
      </section>
      <section className="inspector-section property-card identity-property-card">
        <div className="property-section-title">
          <span className="eyebrow">Record identity</span>
          <h3>Name and classification</h3>
        </div>
        <TextField
          label="Name"
          value={object.name}
          onChange={(name) => updateObject(object.id, { name })}
        />
        <TextField
          label="Index code"
          value={object.indexCode}
          onChange={(indexCode) => updateObject(object.id, { indexCode: indexCode.toUpperCase() })}
        />
        <label className="property-field">
          <span>Layer</span>
          <select
            value={object.layerId}
            onChange={(event) => updateObject(object.id, { layerId: event.target.value })}
          >
            {room.scene.layers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="property-field">
          <span>Zone</span>
          <select
            value={object.zoneId ?? ""}
            onChange={(event) => updateObject(object.id, { zoneId: event.target.value || null })}
          >
            <option value="">None</option>
            {room.scene.zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.code} · {zone.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="inspector-section property-card transform-property-card">
        <div className="property-section-title">
          <span className="eyebrow">Spatial properties</span>
          <h3>Position and dimensions</h3>
        </div>
        {!isHostedOpening && (
          <div className={`property-grid ${supportsFreeTransform ? "three" : "two"}`}>
            <TextField
              label="X"
              value={Math.round(object.position.x)}
              type="number"
              suffix="mm"
              onChange={(value) => setNumber("position", "x", value)}
            />
            <TextField
              label="Y"
              value={Math.round(object.position.y)}
              type="number"
              suffix="mm"
              onChange={(value) => setNumber("position", "y", value)}
            />
            {supportsFreeTransform && (
              <TextField
                label="Raised from floor"
                value={Math.round(object.position.z)}
                type="number"
                suffix="mm"
                onChange={(value) =>
                  updateObject(
                    object.id,
                    {
                      position: {
                        ...object.position,
                        z: normalizeRaisedFromFloorMm(value, object.position.z),
                      },
                    },
                    "Set raised from floor",
                  )
                }
              />
            )}
          </div>
        )}
        <div className={`property-grid ${isHostedOpening ? "two" : "three"}`}>
          <TextField
            label="Width"
            value={Math.round(object.dimensions.width)}
            type="number"
            suffix="mm"
            onChange={(value) => setNumber("dimensions", "width", value)}
          />
          {!isHostedOpening && (
            <TextField
              label="Depth"
              value={Math.round(object.dimensions.depth)}
              type="number"
              suffix="mm"
              onChange={(value) => setNumber("dimensions", "depth", value)}
            />
          )}
          <TextField
            label="Height"
            value={Math.round(object.dimensions.height)}
            type="number"
            suffix="mm"
            onChange={(value) => setNumber("dimensions", "height", value)}
          />
        </div>
        {!isHostedOpening && (
          <TextField
            label="Rotation"
            value={Math.round(object.rotation.z)}
            type="number"
            suffix="°"
            onChange={(value) => setNumber("rotation", "z", value)}
          />
        )}
        {supportsFreeTransform && (
          <div className="toggle-row transform-flip-row" aria-label="Object mirroring">
            <button
              className={object.flipHorizontal ? "active" : ""}
              aria-pressed={object.flipHorizontal}
              title="Mirror this object from left to right"
              onClick={() =>
                updateObject(
                  object.id,
                  { flipHorizontal: !object.flipHorizontal },
                  "Flip object horizontally",
                )
              }
            >
              Flip horizontal
            </button>
            <button
              className={object.flipVertical ? "active" : ""}
              aria-pressed={object.flipVertical}
              title="Mirror this object from front to back"
              onClick={() =>
                updateObject(
                  object.id,
                  { flipVertical: !object.flipVertical },
                  "Flip object vertically",
                )
              }
            >
              Flip vertical
            </button>
          </div>
        )}
        <div className="toggle-row">
          <span>Locked</span>
          <button
            className={object.locked ? "active" : ""}
            onClick={() => updateObject(object.id, { locked: !object.locked })}
          >
            {object.locked ? <LockSimple size={15} /> : <LockSimpleOpen size={15} />}
            {object.locked ? "Locked" : "Unlocked"}
          </button>
          <span>Visible</span>
          <button
            className={object.visible ? "active" : ""}
            onClick={() => updateObject(object.id, { visible: !object.visible })}
          >
            {object.visible ? <Eye size={15} /> : <EyeSlash size={15} />}
            {object.visible ? "Shown" : "Hidden"}
          </button>
        </div>
        <div className="property-notes-block">
          <TextField
            label="Notes"
            value={String(object.metadata.notes ?? "")}
            multiline
            onChange={(notes) =>
              updateObject(object.id, { metadata: { ...object.metadata, notes } })
            }
          />
        </div>
      </section>
      {object.wall && (
        <section className="inspector-section surface-library-section">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Selected wall</span>
              <h3>Wall material</h3>
            </div>
            {typeof object.metadata.wallFinishId === "string" && (
              <button
                className="small-primary"
                onClick={() => {
                  const metadata = { ...object.metadata };
                  delete metadata.wallFinishId;
                  updateObject(object.id, { metadata }, "Use room wall material");
                }}
              >
                Use room finish
              </button>
            )}
          </div>
          <SurfaceMaterialPicker
            label="Finish"
            value={objectWallFinish!.id}
            compact
            choices={LABORATORY_WALL_FINISHES.map((finish) => ({
              id: finish.id,
              label: finish.label,
              description: finish.description,
              color: finish.color,
              accent: finish.baseboardColor,
            }))}
            onChange={(wallFinishId) =>
              updateObject(
                object.id,
                { metadata: { ...object.metadata, wallFinishId } },
                "Change wall material",
              )
            }
          />
        </section>
      )}
      {object.wall && (
        <section className="inspector-section">
          <h3>Wall geometry</h3>
          <div className="property-grid two">
            <TextField
              label="Start X"
              value={Math.round(object.wall.start.x)}
              type="number"
              suffix="mm"
              onChange={(value) =>
                updateObject(
                  object.id,
                  { wall: { ...object.wall!, start: { ...object.wall!.start, x: Number(value) } } },
                  "Edit wall endpoint",
                )
              }
            />
            <TextField
              label="Start Y"
              value={Math.round(object.wall.start.y)}
              type="number"
              suffix="mm"
              onChange={(value) =>
                updateObject(
                  object.id,
                  { wall: { ...object.wall!, start: { ...object.wall!.start, y: Number(value) } } },
                  "Edit wall endpoint",
                )
              }
            />
          </div>
          <div className="property-grid two">
            <TextField
              label="End X"
              value={Math.round(object.wall.end.x)}
              type="number"
              suffix="mm"
              onChange={(value) =>
                updateObject(
                  object.id,
                  { wall: { ...object.wall!, end: { ...object.wall!.end, x: Number(value) } } },
                  "Edit wall endpoint",
                )
              }
            />
            <TextField
              label="End Y"
              value={Math.round(object.wall.end.y)}
              type="number"
              suffix="mm"
              onChange={(value) =>
                updateObject(
                  object.id,
                  { wall: { ...object.wall!, end: { ...object.wall!.end, y: Number(value) } } },
                  "Edit wall endpoint",
                )
              }
            />
          </div>
          <div className="property-grid two">
            <TextField
              label="Thickness"
              value={Math.round(object.wall.thickness)}
              type="number"
              suffix="mm"
              onChange={(value) =>
                updateObject(
                  object.id,
                  { wall: { ...object.wall!, thickness: Number(value) } },
                  "Edit wall thickness",
                )
              }
            />
            <TextField
              label="Wall height"
              value={Math.round(object.wall.height)}
              type="number"
              suffix="mm"
              onChange={(value) =>
                updateObject(
                  object.id,
                  { wall: { ...object.wall!, height: Number(value) } },
                  "Edit wall height",
                )
              }
            />
          </div>
        </section>
      )}
      {object.opening && (
        <section className="inspector-section">
          <h3>{object.objectType === "door" ? "Door opening" : "Window opening"}</h3>
          <div className="info-stat">
            <span>Hosted on</span>
            <b>{hostedWall?.name ?? "Missing wall"}</b>
          </div>
          <div className="property-grid two">
            <TextField
              label="Wall offset"
              value={Math.round(object.opening.offset)}
              type="number"
              suffix="mm"
              onChange={(value) =>
                updateObject(
                  object.id,
                  { opening: { ...object.opening!, offset: Number(value) } },
                  "Move wall opening",
                )
              }
            />
            <TextField
              label="Raised from floor"
              value={Math.round(object.opening.sillHeight)}
              type="number"
              suffix="mm"
              onChange={(value) =>
                updateObject(
                  object.id,
                  {
                    opening: {
                      ...object.opening!,
                      sillHeight: normalizeRaisedFromFloorMm(value, object.opening!.sillHeight),
                    },
                  },
                  "Set opening height from floor",
                )
              }
            />
          </div>
          <div className="toggle-row transform-flip-row" aria-label="Opening direction">
            <button
              className={
                object.objectType === "door"
                  ? object.opening.handing === "right"
                    ? "active"
                    : ""
                  : object.flipHorizontal
                    ? "active"
                    : ""
              }
              aria-pressed={
                object.objectType === "door"
                  ? object.opening.handing === "right"
                  : object.flipHorizontal
              }
              onClick={() =>
                object.objectType === "door"
                  ? updateObject(
                      object.id,
                      {
                        opening: {
                          ...object.opening!,
                          handing: object.opening!.handing === "left" ? "right" : "left",
                        },
                      },
                      "Flip door horizontally",
                    )
                  : updateObject(
                      object.id,
                      { flipHorizontal: !object.flipHorizontal },
                      "Flip window horizontally",
                    )
              }
            >
              Flip horizontal
            </button>
            <button
              className={
                object.objectType === "door"
                  ? object.opening.swing === "outward"
                    ? "active"
                    : ""
                  : object.flipVertical
                    ? "active"
                    : ""
              }
              aria-pressed={
                object.objectType === "door"
                  ? object.opening.swing === "outward"
                  : object.flipVertical
              }
              disabled={object.objectType === "door" && object.opening.swing === "sliding"}
              title={
                object.objectType === "door" && object.opening.swing === "sliding"
                  ? "Sliding doors do not have an inward or outward swing"
                  : "Mirror the opening from front to back"
              }
              onClick={() =>
                object.objectType === "door"
                  ? updateObject(
                      object.id,
                      {
                        opening: {
                          ...object.opening!,
                          swing: object.opening!.swing === "inward" ? "outward" : "inward",
                        },
                      },
                      "Flip door vertically",
                    )
                  : updateObject(
                      object.id,
                      { flipVertical: !object.flipVertical },
                      "Flip window vertically",
                    )
              }
            >
              Flip vertical
            </button>
          </div>
          {object.objectType === "door" && (
            <div className="property-grid two">
              <label className="property-field">
                <span>Handing</span>
                <select
                  value={object.opening.handing}
                  onChange={(event) =>
                    updateObject(
                      object.id,
                      {
                        opening: {
                          ...object.opening!,
                          handing: event.target.value as "left" | "right",
                        },
                      },
                      "Edit door handing",
                    )
                  }
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="property-field">
                <span>Swing</span>
                <select
                  value={object.opening.swing}
                  onChange={(event) =>
                    updateObject(
                      object.id,
                      {
                        opening: {
                          ...object.opening!,
                          swing: event.target.value as "inward" | "outward" | "sliding",
                        },
                      },
                      "Edit door swing",
                    )
                  }
                >
                  <option value="inward">Inward</option>
                  <option value="outward">Outward</option>
                  <option value="sliding">Sliding</option>
                </select>
              </label>
            </div>
          )}
        </section>
      )}
      {definition.indexingBehavior === "storage" && !root && (
        <section className="inspector-section storage-config">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Storage configuration</span>
              <h3>Reference compartments available</h3>
            </div>
          </div>
          <p className="muted-copy">
            Add the authored drawers, cabinets, and shelves for this exact bench or storage family
            so every location can be indexed in the Spatial Index.
          </p>
          <button onClick={() => initializeStorageForObject(object.id)}>
            <TreeStructure size={16} />
            Set up {definition.storageTemplate?.length ?? 0} compartments
          </button>
        </section>
      )}
      {root && (
        <section className="inspector-section storage-config">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Storage configuration</span>
              <h3>{descendants.length} internal locations</h3>
            </div>
            <button
              onClick={() => {
                setSelectedLocation(root.id);
              }}
            >
              <TreeStructure size={16} />
              Open index
            </button>
          </div>
          <div className="stat-grid">
            <Stat
              label="Shelves"
              value={descendants.filter((location) => location.type === "shelf").length}
            />
            <Stat
              label="Drawers"
              value={descendants.filter((location) => location.type === "drawer").length}
            />
            <Stat
              label="Compartments"
              value={descendants.filter((location) => location.type === "compartment").length}
            />
            <Stat
              label="Bins"
              value={descendants.filter((location) => location.type === "bin").length}
            />
          </div>
          <div className="add-child-row">
            <button onClick={() => addChild(root.id, "shelf")}>
              <Plus size={13} />
              Shelf
            </button>
            <button onClick={() => addChild(root.id, "drawer")}>
              <Plus size={13} />
              Drawer
            </button>
            <button onClick={() => addChild(root.id, "compartment")}>
              <Plus size={13} />
              Compartment
            </button>
          </div>
        </section>
      )}
      {record && (
        <EquipmentEditor record={record} update={(patch) => updateRecord(record.id, patch)} />
      )}
      <section className="inspector-section action-footer">
        <button onClick={() => updateObject(object.id, { zIndex: maximumZ + 1 }, "Bring forward")}>
          <ArrowUp size={16} />
          Bring forward
        </button>
        <button onClick={() => updateObject(object.id, { zIndex: minimumZ - 1 }, "Send backward")}>
          <ArrowDown size={16} />
          Send backward
        </button>
        <button onClick={duplicate}>
          <Selection size={16} />
          Duplicate
        </button>
        <button className="danger" onClick={remove}>
          <Trash size={16} />
          Delete
        </button>
      </section>
    </div>
  );
}

function EquipmentEditor({
  record,
  update,
}: {
  record: EquipmentRecord;
  update: (patch: Partial<EquipmentRecord>) => void;
}) {
  return (
    <section className="inspector-section equipment-record">
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">Equipment record</span>
          <h3>{record.equipmentId}</h3>
        </div>
        <span className={`status-badge ${record.status}`}>
          {record.status.replaceAll("-", " ")}
        </span>
      </div>
      <div className="equipment-record-photo-row">
        {record.imageSrc ? (
          <img src={record.imageSrc} alt="" className="equipment-record-photo" />
        ) : (
          <span className="equipment-record-photo equipment-record-photo-empty">
            <Package size={24} weight="duotone" />
          </span>
        )}
        <TextField
          label="Record photo URL"
          value={record.imageSrc ?? ""}
          type="url"
          onChange={(imageSrc) => update({ imageSrc: imageSrc || undefined })}
        />
      </div>
      <div className="property-grid two">
        <TextField
          label="Equipment ID"
          value={record.equipmentId}
          onChange={(equipmentId) => update({ equipmentId })}
        />
        <TextField
          label="Manufacturer"
          value={record.manufacturer}
          onChange={(manufacturer) => update({ manufacturer })}
        />
      </div>
      <div className="property-grid two">
        <TextField label="Model" value={record.model} onChange={(model) => update({ model })} />
        <TextField
          label="Serial number"
          value={record.serialNumber}
          onChange={(serialNumber) => update({ serialNumber })}
        />
      </div>
      <label className="property-field">
        <span>Status</span>
        <select
          value={record.status}
          onChange={(event) => update({ status: event.target.value as EquipmentRecord["status"] })}
        >
          <option value="active">Active</option>
          <option value="service-due">Service due</option>
          <option value="out-of-service">Out of service</option>
          <option value="reserved">Reserved</option>
        </select>
      </label>
      <TextField
        label="Responsible person"
        value={record.responsiblePerson}
        onChange={(responsiblePerson) => update({ responsiblePerson })}
      />
      <div className="property-grid two">
        <TextField
          label="Last service"
          value={record.lastServiceDate ?? ""}
          type="date"
          onChange={(lastServiceDate) => update({ lastServiceDate: lastServiceDate || null })}
        />
        <TextField
          label="Next service"
          value={record.nextServiceDate ?? ""}
          type="date"
          onChange={(nextServiceDate) => update({ nextServiceDate: nextServiceDate || null })}
        />
      </div>
      <div className="property-grid two">
        <TextField
          label="Power"
          value={record.powerRequirements}
          onChange={(powerRequirements) => update({ powerRequirements })}
        />
        <TextField
          label="Water"
          value={record.waterRequirements}
          onChange={(waterRequirements) => update({ waterRequirements })}
        />
      </div>
      <div className="property-grid two">
        <TextField
          label="Gas"
          value={record.gasRequirements}
          onChange={(gasRequirements) => update({ gasRequirements })}
        />
        <TextField label="Notes" value={record.notes} onChange={(notes) => update({ notes })} />
      </div>
      <div className="toggle-row">
        <span>Drain</span>
        <button
          className={record.drainRequired ? "active" : ""}
          onClick={() => update({ drainRequired: !record.drainRequired })}
        >
          {record.drainRequired ? "Required" : "Not required"}
        </button>
        <span>Ventilation</span>
        <button
          className={record.ventilationRequired ? "active" : ""}
          onClick={() => update({ ventilationRequired: !record.ventilationRequired })}
        >
          {record.ventilationRequired ? "Required" : "Not required"}
        </button>
      </div>
    </section>
  );
}

function PropertiesPanel() {
  const room = useEditorStore(selectActiveRoom);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selected = useMemo(
    () => room.scene.objects.filter((object) => selectedIds.includes(object.id)),
    [room.scene.objects, selectedIds],
  );
  if (!selected.length)
    return (
      <div className="empty-state panel-empty">
        <Selection size={38} />
        <b>Select an object</b>
        <span>
          Its dimensions, index identity, storage configuration, and equipment record will appear
          here.
        </span>
      </div>
    );
  if (selected.length > 1)
    return (
      <div className="empty-state panel-empty">
        <Selection size={38} />
        <b>{selected.length} objects selected</b>
        <span>Drag the group, duplicate it, assign a layer, or delete the selection.</span>
      </div>
    );
  return <ObjectProperties object={selected[0]} />;
}

function ValidationPanel() {
  const room = useEditorStore(selectActiveRoom);
  const setSelected = useEditorStore((state) => state.setSelected);
  const setPresentation = useEditorStore((state) => state.setPresentation);
  const warnings = validatePlacement(room);
  return (
    <div className="inspector-scroll validation-panel">
      <section className="inspector-section">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Non-destructive checks</span>
            <h3>{warnings.length} placement warnings</h3>
          </div>
          <span className={`validation-score ${warnings.length ? "has-warnings" : "clear"}`}>
            {warnings.length ? "Review" : "Clear"}
          </span>
        </div>
        <p className="section-copy">Warnings help review a layout but do not block placement.</p>
        <div className="warning-list">
          {warnings.map((warning) => (
            <button
              key={warning.id}
              onClick={() => {
                setSelected(warning.objectIds);
                setPresentation("split");
              }}
            >
              <Warning size={18} weight={warning.severity === "error" ? "fill" : "regular"} />
              <span>
                <b>{warning.title}</b>
                {warning.message}
              </span>
              <em>{warning.objectIds.length}</em>
            </button>
          ))}
          {!warnings.length && (
            <div className="empty-state compact">
              <Selection size={24} />
              <b>No current warnings</b>
              <span>Objects are inside the room and index codes are unique.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type InspectorPanelsProps = {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function InspectorPanels({ collapsed = false, onCollapsedChange }: InspectorPanelsProps) {
  const panel = useEditorStore((state) => state.panel);
  const setPanel = useEditorStore((state) => state.setPanel);
  const warningCount = validatePlacement(useEditorStore(selectActiveRoom)).length;

  if (collapsed) {
    return (
      <section
        id="room-inspector-panel"
        className="inspector is-collapsed"
        aria-label="Room inspector"
      >
        <button
          className="collapsed-panel-rail inspector-rail"
          onClick={() => onCollapsedChange?.(false)}
          aria-label="Expand room inspector"
          aria-expanded="false"
          aria-controls="room-inspector-panel"
          title="Expand room inspector"
        >
          <CaretLeft size={18} />
          <span>Inspector</span>
        </button>
      </section>
    );
  }

  return (
    <section id="room-inspector-panel" className="inspector" aria-label="Room inspector">
      <div className="inspector-tab-row">
        <div className="inspector-tabs" role="tablist">
          {panelTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={panel === tab.id}
                className={panel === tab.id ? "active" : ""}
                onClick={() => setPanel(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.id === "validation" && warningCount > 0 && <em>{warningCount}</em>}
              </button>
            );
          })}
        </div>
        <button
          className="inspector-collapse-control"
          onClick={() => onCollapsedChange?.(true)}
          aria-label="Collapse room inspector"
          aria-expanded="true"
          aria-controls="room-inspector-panel"
          title="Collapse room inspector"
        >
          <CaretRight size={17} />
        </button>
      </div>
      <div className="inspector-content" role="tabpanel">
        {panel === "room" && <RoomPanel />}
        {panel === "layers" && <LayersPanel />}
        {panel === "index" && <IndexPanel />}
        {panel === "inventory" && <InventoryPanel />}
        {panel === "properties" && <PropertiesPanel />}
        {panel === "validation" && <ValidationPanel />}
      </div>
    </section>
  );
}
