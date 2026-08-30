import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Cube,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  Package,
  Plus,
  TreeStructure,
  Trash,
} from "@phosphor-icons/react";
import { useState } from "react";
import { getAssetDefinition } from "../domain/assets";
import { storagePath } from "../domain/inventory-organization";
import type { Room, StorageLocation, StorageLocationType } from "../domain/schema";
import { STORAGE_RIGS } from "../domain/storage-access";
import { missingStorageCount } from "../domain/storage-templates";
import { navigateWorkspace } from "../lib/workspace-navigation";
import { useEditorStore } from "../store/editor-store";
import { AssetThumbnail } from "./AssetThumbnail";
import { InventoryOrganizer, type InventoryOrganizerOptions } from "./InventoryOrganizer";
import { InventoryThumbnail } from "./InventoryThumbnail";
import { StorageMap } from "./StorageMap";
import { StorageNameEditor } from "./StorageNameEditor";
import { StoragePreview } from "./StoragePreview";
import "./StorageWorkspace.css";

const childOptions: Record<StorageLocationType, StorageLocationType[]> = {
  cabinet: ["compartment", "shelf", "drawer"],
  compartment: ["shelf", "bin"],
  shelf: ["bin"],
  drawer: ["bin"],
  bin: [],
};
export type StorageSelection = {
  roomId: string;
  objectId?: string | null;
  locationId?: string | null;
};

function AdvancedStorage({
  room,
  location,
  onChoose,
}: {
  room: Room;
  location: StorageLocation;
  onChoose: (id: string) => void;
}) {
  const [code, setCode] = useState(location.indexCode);
  const [notes, setNotes] = useState(location.capacityNotes);
  const [error, setError] = useState("");
  const pending = useEditorStore((state) => Boolean(state.pendingAgentChange));
  const object = room.scene.objects.find((entry) => entry.id === location.objectId);
  const slots = object
    ? (STORAGE_RIGS[object.assetDefinitionId]?.locations ?? []).filter(
        (slot) => slot.type === location.type,
      )
    : [];
  const store = useEditorStore;
  const openLayoutDialog = (dialog: "labels" | "reindex") => {
    const state = store.getState();
    if (state.project.activeRoomId !== room.id) state.switchRoom(room.id);
    state.setSelectedLocation(location.id);
    state.setDialog(dialog);
    navigateWorkspace("/");
  };
  return (
    <details className="storage-advanced">
      <summary>Advanced details</summary>
      <div className="storage-add-child">
        <span>Labels and room codes</span>
        <p>Open this room in the Layout Editor for label printing or reviewed reindexing.</p>
        <button disabled={pending} onClick={() => openLayoutDialog("labels")}>
          Label preview in layout
        </button>
        <button disabled={pending} onClick={() => openLayoutDialog("reindex")}>
          Reindex in layout
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = code.trim().toUpperCase();
          if (!value || value.length > 120) {
            setError("Use a code between 1 and 120 characters.");
            return;
          }
          if (
            room.scene.storageLocations.some(
              (entry) => entry.id !== location.id && entry.indexCode === value,
            )
          ) {
            setError("This code is already used in this room.");
            return;
          }
          setError("");
          store
            .getState()
            .updateStorageLocation(
              location.id,
              { indexCode: value, capacityNotes: notes },
              room.id,
            );
        }}
      >
        <label>
          Index code
          <input value={code} maxLength={120} onChange={(event) => setCode(event.target.value)} />
        </label>
        <label>
          Capacity notes
          <textarea value={notes} rows={3} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          disabled={pending || (code === location.indexCode && notes === location.capacityNotes)}
          type="submit"
        >
          Save details
        </button>
      </form>
      {slots.length > 0 && (
        <label>
          Physical access target
          <select
            disabled={pending}
            value={location.anatomyKey ?? ""}
            onChange={(event) =>
              store.getState().bindStorageAnatomy(location.id, event.target.value || null, room.id)
            }
          >
            <option value="">Not explicitly linked</option>
            {slots.map((slot) => (
              <option
                key={slot.key}
                value={slot.key}
                disabled={room.scene.storageLocations.some(
                  (entry) =>
                    entry.objectId === location.objectId &&
                    entry.id !== location.id &&
                    entry.anatomyKey === slot.key,
                )}
              >
                {slot.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {childOptions[location.type].length > 0 && (
        <div className="storage-add-child">
          <span>Add a nested location</span>
          <p>Custom labels do not add new physical drawers to the model.</p>
          {childOptions[location.type].map((type) => (
            <button
              key={type}
              disabled={pending}
              onClick={() => {
                const id = store.getState().addStorageChild(location.id, type, room.id);
                if (id) onChoose(id);
              }}
            >
              <Plus size={14} /> Add {type}
            </button>
          ))}
        </div>
      )}
      {location.parentId && (
        <button
          className="storage-remove"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                `Remove “${location.name}” and its nested locations? Inventory is kept and becomes unassigned. This can be undone.`,
              )
            )
              return;
            store.getState().removeStorageLocation(location.id, room.id);
            onChoose(location.parentId!);
          }}
        >
          <Trash size={15} /> Remove location
        </button>
      )}
    </details>
  );
}

export function StorageWorkspace({
  selection,
  onSelection,
  onOpenItem,
}: {
  selection: StorageSelection;
  onSelection: (value: StorageSelection) => void;
  onOpenItem: (roomId: string, itemId: string) => void;
}) {
  const project = useEditorStore((state) => state.project);
  const pending = useEditorStore((state) => Boolean(state.pendingAgentChange));
  const [query, setQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [locationQuery, setLocationQuery] = useState("");
  const [organizer, setOrganizer] = useState<InventoryOrganizerOptions | null>(null);
  const [view, setView] = useState<"map" | "3d">("map");
  const [addingAt, setAddingAt] = useState<string | null>(null);
  const rooms = project.rooms.filter((entry) => entry.roomKind !== "demo-template");
  const units = rooms.flatMap((room) =>
    room.scene.storageLocations
      .filter((entry) => !entry.parentId)
      .map((root) => ({
        room,
        root,
        object: room.scene.objects.find((entry) => entry.id === root.objectId),
      })),
  );
  const effectiveRoomId = rooms.some((entry) => entry.id === selection.roomId)
    ? selection.roomId
    : project.activeRoomId;
  const selectedUnit =
    units.find(
      (entry) => entry.room.id === selection.roomId && entry.root.objectId === selection.objectId,
    ) ??
    units.find(
      (entry) =>
        entry.room.id === selection.roomId &&
        entry.room.scene.storageLocations.some(
          (location) =>
            location.id === selection.locationId && location.objectId === entry.root.objectId,
        ),
    ) ??
    units.find((entry) => entry.room.id === effectiveRoomId);
  const room =
    selectedUnit?.room ?? rooms.find((entry) => entry.id === effectiveRoomId) ?? rooms[0];
  const related =
    room && selectedUnit
      ? room.scene.storageLocations.filter((entry) => entry.objectId === selectedUnit.root.objectId)
      : [];
  const selected = related.find((entry) => entry.id === selection.locationId) ?? selectedUnit?.root;
  const laboratory = project.laboratories.find((entry) => entry.id === room?.laboratoryId);
  const path = selected ? storagePath(related, selected.id) : [];
  const contents =
    room && selected
      ? room.scene.inventoryItems.filter((item) =>
          selected.parentId
            ? item.storageLocationId === selected.id
            : related.some((entry) => entry.id === item.storageLocationId),
        )
      : [];
  const filteredUnits = units.filter(({ room: unitRoom, root }) => {
    const lab = project.laboratories.find((entry) => entry.id === unitRoom.laboratoryId);
    const locations = unitRoom.scene.storageLocations.filter(
      (entry) => entry.objectId === root.objectId,
    );
    const stock = unitRoom.scene.inventoryItems.filter((item) =>
      locations.some((entry) => entry.id === item.storageLocationId),
    );
    return (
      (roomFilter === "all" || unitRoom.id === roomFilter) &&
      [
        lab?.name,
        lab?.code,
        unitRoom.name,
        unitRoom.code,
        ...locations.flatMap((entry) => [entry.name, entry.indexCode]),
        ...stock.map((item) => item.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    );
  });
  const choose = (locationId: string) => {
    if (!room || !selectedUnit) return;
    onSelection({ roomId: room.id, objectId: selectedUnit.root.objectId, locationId });
    setAddingAt(null);
  };
  const missing =
    room?.scene.objects.reduce(
      (count, object) =>
        count +
        missingStorageCount(
          getAssetDefinition(object.assetDefinitionId),
          object.id,
          room.scene.storageLocations,
        ),
      0,
    ) ?? 0;
  return (
    <section className="storage-workspace" aria-label="Storage workspace">
      <aside className="storage-cabinet-rail" aria-label="Storage units">
        <header>
          <span className="eyebrow">Across your laboratories</span>
          <h2>
            Storage units <small>{units.length}</small>
          </h2>
        </header>
        <label className="storage-search">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search storage"
            placeholder="Cabinet, contents or code…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="storage-room-filter">
          Location filter
          <select
            aria-label="Location filter"
            value={roomFilter}
            onChange={(event) => setRoomFilter(event.target.value)}
          >
            <option value="all">All laboratories & rooms</option>
            {project.laboratories.map((lab) => (
              <optgroup key={lab.id} label={`${lab.name} · ${lab.code}`}>
                {rooms
                  .filter((entry) => entry.laboratoryId === lab.id)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {entry.code}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="storage-unit-scroll">
          {rooms.map((entry) => {
            const matches = filteredUnits.filter((unit) => unit.room.id === entry.id);
            if (!matches.length) return null;
            const lab = project.laboratories.find((value) => value.id === entry.laboratoryId);
            return (
              <section key={entry.id} className="storage-room-group">
                <h3>
                  {entry.name}
                  <small>
                    {lab?.code} / {entry.code}
                  </small>
                </h3>
                {matches.map(({ root, object }) => (
                  <button
                    key={root.id}
                    className="storage-unit-button"
                    aria-pressed={selectedUnit?.root.id === root.id}
                    aria-label={`Manage ${root.name} in ${entry.code}`}
                    onClick={() => {
                      onSelection({
                        roomId: entry.id,
                        objectId: root.objectId,
                        locationId: root.id,
                      });
                      setLocationQuery("");
                      setAddingAt(null);
                    }}
                  >
                    <span className="storage-unit-image">
                      {object ? (
                        <AssetThumbnail asset={getAssetDefinition(object.assetDefinitionId)} />
                      ) : (
                        <Archive size={24} />
                      )}
                    </span>
                    <span>
                      <b>{root.name}</b>
                      <small>
                        {
                          entry.scene.storageLocations.filter(
                            (location) => location.objectId === root.objectId && location.parentId,
                          ).length
                        }{" "}
                        locations
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </section>
            );
          })}
          {!filteredUnits.length && (
            <div className="storage-empty">
              <Archive size={30} />
              <b>No matching storage</b>
              <p>
                Try a different room or search. Add a cabinet or storage bench in the Layout Editor.
              </p>
            </div>
          )}
        </div>
      </aside>
      <section className="storage-map-workspace" aria-label="Cabinet workspace">
        <header className="storage-workspace-context">
          <div>
            <span className="eyebrow">{laboratory?.name ?? "Laboratory"}</span>
            <h2>
              {room?.name ?? "Choose a room"} <small>{room?.code}</small>
            </h2>
          </div>
          <button onClick={() => navigateWorkspace("/")}>
            <ArrowLeft size={16} /> Back to layout
          </button>
        </header>
        {selectedUnit && room ? (
          <div className="storage-map-scroll">
            <div className="storage-view-controls" role="group" aria-label="Storage view">
              <button aria-pressed={view === "map"} onClick={() => setView("map")}>
                <TreeStructure size={17} /> Storage map
              </button>
              <button
                aria-pressed={view === "3d"}
                disabled={!selectedUnit.object}
                onClick={() => setView("3d")}
              >
                <Cube size={17} /> 3D access preview
              </button>
              <span>{related.length} named locations</span>
            </div>
            {selectedUnit.object &&
              (view === "map" ? (
                <StorageMap
                  key={selectedUnit.object.id}
                  room={room}
                  object={selectedUnit.object}
                  selectedId={selected?.id ?? null}
                  onChoose={choose}
                />
              ) : (
                <StoragePreview
                  key={`${selectedUnit.object.id}:${selected?.id}`}
                  room={room}
                  object={selectedUnit.object}
                  locationId={selected?.id ?? null}
                />
              ))}
            <section className="storage-location-directory" aria-label="Named storage locations">
              <header>
                <h3>
                  <ListBullets size={18} /> Locations
                </h3>
                <input
                  aria-label="Filter storage locations"
                  placeholder="Find a shelf or drawer…"
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                />
              </header>
              <div className="storage-location-grid">
                {related
                  .filter((entry) =>
                    `${entry.name} ${entry.indexCode}`
                      .toLowerCase()
                      .includes(locationQuery.trim().toLowerCase()),
                  )
                  .map((entry) => (
                    <button
                      key={entry.id}
                      aria-pressed={selected?.id === entry.id}
                      onClick={() => choose(entry.id)}
                    >
                      <span className="storage-location-type">{entry.type}</span>
                      <b>{entry.name}</b>
                      <small>
                        {storagePath(related, entry.id)
                          .slice(0, -1)
                          .map((value) => value.name)
                          .join(" / ") || "Whole storage unit"}
                      </small>
                    </button>
                  ))}
              </div>
            </section>
            {missing > 0 && (
              <section className="storage-setup-note">
                <TreeStructure size={24} />
                <div>
                  <b>Storage setup available in this room</b>
                  <p>
                    Link missing physical drawers and shelves without replacing your saved names or
                    inventory.
                  </p>
                </div>
                <button
                  disabled={pending}
                  onClick={() => useEditorStore.getState().completeRoomStorage(room.id)}
                >
                  Complete room storage
                </button>
              </section>
            )}
          </div>
        ) : (
          <div className="storage-empty">
            <Archive size={40} />
            <h2>A place for everything</h2>
            <p>
              Add storage furniture to a room, then name its shelves and assign your inventory here.
            </p>
            {room && missing > 0 && (
              <button onClick={() => useEditorStore.getState().completeRoomStorage(room.id)}>
                Complete room storage
              </button>
            )}
          </div>
        )}
      </section>
      <aside className="storage-content-panel" aria-label="Selected storage contents">
        {room && selected ? (
          <>
            <header>
              <span className="eyebrow">
                {selected.type} · {contents.length} records
              </span>
              <StorageNameEditor key={selected.id} roomId={room.id} locationId={selected.id} />
              <p>
                {[laboratory?.code, room.code, ...path.slice(0, -1).map((entry) => entry.name)]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
              <code>{selected.indexCode}</code>
            </header>
            <div className="storage-content-actions">
              <button
                className="storage-primary"
                disabled={pending}
                onClick={() =>
                  setOrganizer({ initialRoomId: room.id, initialLocationId: selected.id })
                }
              >
                <MapPin size={17} /> Assign items
              </button>
              <button
                disabled={pending}
                aria-expanded={addingAt === selected.id}
                onClick={() => setAddingAt(addingAt === selected.id ? null : selected.id)}
              >
                <Plus size={17} /> Add item
              </button>
            </div>
            {addingAt === selected.id && (
              <form
                className="storage-new-item"
                aria-label="New item at this location"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (pending) return;
                  const data = new FormData(event.currentTarget);
                  const name = String(data.get("name") ?? "").trim();
                  const unit = String(data.get("unit") ?? "").trim();
                  const quantity = Number(data.get("quantity"));
                  if (!name || !unit || !Number.isFinite(quantity) || quantity < 0) return;
                  const id = useEditorStore
                    .getState()
                    .addInventoryItemToRoom(room.id, selected.id, { name, unit, quantity });
                  if (id) {
                    setAddingAt(null);
                    useEditorStore
                      .getState()
                      .pushToast("Inventory item added to this location.", "success");
                  }
                }}
              >
                <label>
                  Item name
                  <input name="name" required maxLength={160} autoFocus />
                </label>
                <div>
                  <label>
                    Quantity
                    <input
                      name="quantity"
                      type="number"
                      min="0"
                      step="any"
                      defaultValue="1"
                      required
                    />
                  </label>
                  <label>
                    Unit
                    <input name="unit" defaultValue="each" required maxLength={40} />
                  </label>
                </div>
                <button disabled={pending} type="submit">
                  Create item here
                </button>
                <button type="button" onClick={() => setAddingAt(null)}>
                  Cancel
                </button>
              </form>
            )}
            <section className="storage-content-list" aria-label="Assigned inventory">
              <h3>{selected.parentId ? "In this exact location" : "In this storage unit"}</h3>
              {contents.map((item) => (
                <article key={item.id}>
                  <InventoryThumbnail item={item} />
                  <div>
                    <button
                      className="storage-item-name"
                      onClick={() => onOpenItem(room.id, item.id)}
                    >
                      {item.name}
                    </button>
                    <b>
                      {item.quantity} {item.unit}
                    </b>
                    {!selected.parentId && item.storageLocationId && (
                      <button
                        className="storage-item-location"
                        onClick={() => choose(item.storageLocationId!)}
                      >
                        {storagePath(related, item.storageLocationId)
                          .slice(1)
                          .map((entry) => entry.name)
                          .join(" → ") || "Whole unit"}
                      </button>
                    )}
                  </div>
                  <button
                    className="storage-move-item"
                    disabled={pending}
                    aria-label={`Move ${item.name}`}
                    onClick={() =>
                      setOrganizer({
                        initialItems: [{ roomId: room.id, itemId: item.id }],
                        initialRoomId: room.id,
                        initialLocationId: item.storageLocationId,
                      })
                    }
                  >
                    <MapPin size={17} />
                  </button>
                </article>
              ))}
              {!contents.length && (
                <div className="storage-empty">
                  <Package size={30} />
                  <b>Ready for inventory</b>
                  <p>Assign existing items or create a record directly in this location.</p>
                </div>
              )}
            </section>
            <button
              className="storage-open-layout"
              onClick={() => {
                const state = useEditorStore.getState();
                if (state.project.activeRoomId !== room.id) state.switchRoom(room.id);
                state.setSelectedLocation(selected.id);
                state.setPanel("index");
                navigateWorkspace("/");
              }}
            >
              <Cube size={17} /> Show this location in layout <ArrowRight size={16} />
            </button>
            <AdvancedStorage
              key={`${selected.id}:${selected.updatedAt}`}
              room={room}
              location={selected}
              onChoose={choose}
            />
          </>
        ) : (
          <div className="storage-empty">
            <Archive size={32} />
            <b>Select a storage unit</b>
            <p>Its named drawers, shelves and inventory will appear here.</p>
          </div>
        )}
      </aside>
      {organizer && <InventoryOrganizer {...organizer} onClose={() => setOrganizer(null)} />}
    </section>
  );
}
