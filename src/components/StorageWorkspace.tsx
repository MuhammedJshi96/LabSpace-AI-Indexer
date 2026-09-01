import {
  Archive,
  ArrowRight,
  CaretDown,
  Check,
  Cube,
  DotsSixVertical,
  MagnifyingGlass,
  MapPin,
  Package,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { getAssetDefinition } from "../domain/assets";
import { storagePath, type InventoryReference } from "../domain/inventory-organization";
import {
  compactStorageLabel,
  storageFullPath,
  storageOptionLabel,
} from "../domain/storage-display";
import type { Room, StorageLocation, StorageLocationType } from "../domain/schema";
import { STORAGE_RIGS } from "../domain/storage-access";
import { missingStorageCount } from "../domain/storage-templates";
import { navigateWorkspace } from "../lib/workspace-navigation";
import { useEditorStore } from "../store/editor-store";
import { AssetThumbnail } from "./AssetThumbnail";
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
  initialItems = [],
  onSelection,
  onOpenItem,
  onAssigned,
}: {
  selection: StorageSelection;
  initialItems?: InventoryReference[];
  onSelection: (value: StorageSelection) => void;
  onOpenItem: (roomId: string, itemId: string) => void;
  onAssigned?: () => void;
}) {
  const project = useEditorStore((state) => state.project);
  const pending = useEditorStore((state) => Boolean(state.pendingAgentChange));
  const assign = useEditorStore((state) => state.assignInventoryItems);
  const [query, setQuery] = useState("");
  const [cabinetQuery, setCabinetQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [roomFilter, setRoomFilter] = useState(selection.roomId || "all");
  const [scope, setScope] = useState("all");
  const [chosen, setChosen] = useState<InventoryReference[]>(initialItems);
  const [dragging, setDragging] = useState<InventoryReference[]>([]);
  const [view, setView] = useState<"map" | "3d">("map");
  const [addingAt, setAddingAt] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const itemSearch = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !picker.current?.contains(event.target))
        setPickerOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [pickerOpen]);
  const rooms = project.rooms.filter((room) => room.roomKind !== "demo-template");
  const units = rooms.flatMap((room) =>
    room.scene.storageLocations
      .filter((location) => !location.parentId)
      .map((root) => ({
        room,
        root,
        object: room.scene.objects.find((object) => object.id === root.objectId),
      })),
  );
  const unit =
    units.find(
      (entry) =>
        entry.room.id === selection.roomId &&
        (entry.root.objectId === selection.objectId ||
          entry.room.scene.storageLocations.some(
            (location) =>
              location.id === selection.locationId && location.objectId === entry.root.objectId,
          )),
    ) ??
    units.find((entry) => entry.room.id === selection.roomId) ??
    units[0];
  const room = unit?.room;
  const related =
    room?.scene.storageLocations.filter((location) => location.objectId === unit?.root.objectId) ??
    [];
  const selected = related.find((location) => location.id === selection.locationId) ?? unit?.root;
  const lab = project.laboratories.find((lab) => lab.id === room?.laboratoryId);
  const selectedPath = selected ? storagePath(related, selected.id) : [];
  const filteredUnits = units.filter(
    (entry) =>
      (roomFilter === "all" || entry.room.id === roomFilter) &&
      (entry.root.name + " " + entry.room.name + " " + entry.room.code)
        .toLowerCase()
        .includes(cabinetQuery.trim().toLowerCase()),
  );
  const allItems = rooms.flatMap((room) =>
    room.scene.inventoryItems.map((item) => ({ room, item })),
  );
  const references = chosen.filter((ref) =>
    allItems.some((row) => row.room.id === ref.roomId && row.item.id === ref.itemId),
  );
  const isChosen = (ref: InventoryReference) =>
    references.some((value) => value.roomId === ref.roomId && value.itemId === ref.itemId);
  const toggle = (ref: InventoryReference) =>
    setChosen(
      isChosen(ref)
        ? references.filter((value) => value.itemId !== ref.itemId || value.roomId !== ref.roomId)
        : [...references, ref],
    );
  const visibleItems = allItems.filter(({ room: source, item }) => {
    const inCabinet =
      source.id === room?.id && related.some((location) => location.id === item.storageLocationId);
    return (
      (scope !== "unassigned" || !item.storageLocationId) &&
      (scope !== "cabinet" || inCabinet) &&
      [
        item.name,
        source.name,
        source.code,
        ...storagePath(source.scene.storageLocations, item.storageLocationId).map(
          (location) => location.name,
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    );
  });
  const contents =
    selected && room
      ? room.scene.inventoryItems.filter((item) =>
          storagePath(related, item.storageLocationId).some(
            (location) => location.id === selected.id,
          ),
        )
      : [];
  const choose = (id: string) => {
    if (!room || !unit) return;
    onSelection({ roomId: room.id, objectId: unit.root.objectId, locationId: id });
    setAddingAt(null);
  };
  const place = (locationId: string, items = references) => {
    if (
      pending ||
      !room ||
      !items.length ||
      !related.some((location) => location.id === locationId)
    )
      return;
    const destination = related.find((location) => location.id === locationId)!;
    if (assign(items, room.id, destination.id)) {
      choose(destination.id);
      setChosen([]);
      setDragging([]);
      onAssigned?.();
      setNotice(
        items.length +
          (items.length === 1 ? " item placed in " : " items placed in ") +
          destination.name +
          ". Undo is available above.",
      );
    }
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
    <section className="storage-workspace simple-storage" aria-label="Storage workspace">
      <aside className="storage-item-tray" aria-label="Items to place">
        <header>
          <span className="placement-step-number">1</span>
          <div>
            <small>Items to place</small>
            <h2>Choose inventory</h2>
          </div>
          <span>{allItems.length}</span>
        </header>
        <p>Select one or more items, then drag them to the storage map.</p>
        <label className="placement-search">
          <MagnifyingGlass size={17} />
          <input
            ref={itemSearch}
            aria-label="Search items to place"
            placeholder="Find an item…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Show inventory"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <option value="all">All inventory</option>
          <option value="unassigned">Without a location</option>
          <option value="cabinet">In this cabinet</option>
        </select>
        <div className="placement-selection">
          <span>
            {references.length
              ? references.length + " selected"
              : "Or select items, then Place here"}
          </span>
          {references.length > 0 && <button onClick={() => setChosen([])}>Clear selection</button>}
        </div>
        <div className="storage-tray-scroll">
          {visibleItems.map(({ room: source, item }) => {
            const ref = { roomId: source.id, itemId: item.id };
            const trail = storagePath(source.scene.storageLocations, item.storageLocationId);
            return (
              <article
                key={item.id}
                className={"storage-tray-item " + (isChosen(ref) ? "is-chosen" : "")}
                aria-label={"Drag " + item.name + " from " + source.code}
                draggable={!pending}
                onDragStart={(event) => {
                  if (pending) {
                    event.preventDefault();
                    return;
                  }
                  const items = isChosen(ref) ? references : [ref];
                  setDragging(items);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "application/x-labspace-inventory",
                    "internal-selection",
                  );
                  event.dataTransfer.setData("text/plain", item.name);
                }}
                onDragEnd={() => setDragging([])}
              >
                <DotsSixVertical size={16} className="placement-grip" aria-hidden />
                <input
                  type="checkbox"
                  aria-label={"Select " + item.name + " in " + source.code}
                  checked={isChosen(ref)}
                  disabled={pending}
                  onChange={() => toggle(ref)}
                />
                <InventoryThumbnail item={item} />
                <button aria-pressed={isChosen(ref)} disabled={pending} onClick={() => toggle(ref)}>
                  <b>{item.name}</b>
                  <span>
                    {item.quantity} {item.unit}
                  </span>
                  <small
                    title={[source.name, ...trail.map((location) => location.name)].join(" / ")}
                  >
                    {source.code} ·{" "}
                    {trail.at(-1)
                      ? compactStorageLabel(trail.at(-1)!.name, trail.at(-1)!.type)
                      : "No location"}
                  </small>
                </button>
              </article>
            );
          })}
          {!visibleItems.length && (
            <div className="placement-empty">
              <Package size={28} />
              <b>No matching items</b>
              <span>Try another search or inventory filter.</span>
            </div>
          )}
        </div>
        <footer>
          <MapPin size={15} />
          <span>Moves change location only—not stock.</span>
        </footer>
      </aside>
      <section className="placement-workbench" aria-label="Cabinet workspace">
        <header className="placement-cabinet-header">
          <div ref={picker} className="placement-cabinet-picker">
            <button
              ref={pickerTrigger}
              className="placement-cabinet-trigger"
              aria-expanded={pickerOpen}
              aria-controls="placement-cabinet-options"
              aria-label="Choose cabinet"
              onClick={() => {
                const opening = !pickerOpen;
                if (opening) {
                  setRoomFilter(room?.id ?? "all");
                  setCabinetQuery("");
                }
                setPickerOpen(opening);
              }}
            >
              <span className="storage-context-model">
                {unit?.object ? (
                  <AssetThumbnail asset={getAssetDefinition(unit.object.assetDefinitionId)} />
                ) : (
                  <Archive size={26} />
                )}
              </span>
              <span>
                <small>
                  <span className="placement-step-kicker">2 · Destination</span>
                  {lab?.name ?? "Storage"}
                  {room && " / " + room.name + " · " + room.code}
                </small>
                <b title={unit?.root.name}>
                  {unit?.root
                    ? compactStorageLabel(unit.root.name, unit.root.type)
                    : "Choose a cabinet"}
                </b>
              </span>
              <CaretDown size={19} />
            </button>
            {pickerOpen && (
              <div
                id="placement-cabinet-options"
                className="placement-cabinet-options"
                role="region"
                aria-label="Choose a cabinet"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setPickerOpen(false);
                    pickerTrigger.current?.focus();
                  }
                }}
              >
                <label className="placement-search">
                  <MagnifyingGlass size={17} />
                  <input
                    autoFocus
                    aria-label="Search storage"
                    placeholder="Find a cabinet or room…"
                    value={cabinetQuery}
                    onChange={(event) => setCabinetQuery(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Location filter"
                  value={roomFilter}
                  onChange={(event) => setRoomFilter(event.target.value)}
                >
                  <option value="all">All rooms</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} · {room.code}
                    </option>
                  ))}
                </select>
                <p className="placement-cabinet-count">
                  {filteredUnits.length}{" "}
                  {filteredUnits.length === 1 ? "storage unit" : "storage units"}
                  {roomFilter !== "all" && " in this room"}
                </p>
                <div>
                  {filteredUnits.map((entry) => (
                    <button
                      key={entry.room.id + "/" + entry.root.id}
                      title={`${entry.root.name} · ${entry.room.name} · ${entry.room.code}`}
                      aria-label={"Manage " + entry.root.name + " in " + entry.room.code}
                      aria-pressed={entry.root.id === unit?.root.id}
                      onClick={() => {
                        onSelection({
                          roomId: entry.room.id,
                          objectId: entry.root.objectId,
                          locationId: entry.root.id,
                        });
                        setPickerOpen(false);
                        setAddingAt(null);
                        pickerTrigger.current?.focus();
                      }}
                    >
                      {entry.object && (
                        <span className="placement-cabinet-thumb">
                          <AssetThumbnail
                            asset={getAssetDefinition(entry.object.assetDefinitionId)}
                          />
                        </span>
                      )}
                      <span>
                        <b>{compactStorageLabel(entry.root.name, entry.root.type)}</b>
                        <small>
                          {entry.room.name} · {entry.room.code}
                        </small>
                      </span>
                      {entry.root.id === unit?.root.id && <Check size={17} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="placement-view-switch" role="group" aria-label="Storage view">
            <button aria-pressed={view === "map"} onClick={() => setView("map")}>
              Storage map
            </button>
            <button
              aria-pressed={view === "3d"}
              disabled={!unit?.object}
              onClick={() => setView("3d")}
            >
              <Cube size={16} />
              3D preview
            </button>
          </div>
        </header>
        {room && unit && selected ? (
          <div className="placement-workbench-scroll">
            {view === "map" && unit.object && (
              <StorageMap
                key={unit.object.id}
                room={room}
                object={unit.object}
                selectedId={selected.id}
                onChoose={choose}
                showHeading={false}
                named
                dropEnabled={!pending && dragging.length > 0}
                onDropItems={(id) => place(id, dragging)}
              />
            )}
            {view === "3d" && unit.object && (
              <StoragePreview
                key={unit.object.id + ":" + selected.id}
                room={room}
                object={unit.object}
                locationId={selected.id}
              />
            )}
            <section className="placement-destination" aria-label="Selected storage contents">
              <div className="placement-destination-heading">
                <div>
                  <nav className="placement-location-trail" aria-label="Selected storage path">
                    {selectedPath.length > 1 ? (
                      selectedPath.slice(0, -1).map((location) => (
                        <button
                          key={location.id}
                          title={location.name}
                          onClick={() => choose(location.id)}
                        >
                          <span>{compactStorageLabel(location.name, location.type)}</span>
                          <CaretDown size={10} weight="bold" aria-hidden />
                        </button>
                      ))
                    ) : (
                      <span>Whole storage unit</span>
                    )}
                  </nav>
                  <small className="placement-location-type">{selected.type}</small>
                  <StorageNameEditor
                    key={selected.id}
                    roomId={room.id}
                    locationId={selected.id}
                    showLabel
                    displayName={compactStorageLabel(selected.name, selected.type)}
                  />
                </div>
                <label>
                  Jump to location
                  <select
                    aria-label="Storage location"
                    title={storageFullPath(related, selected.id)}
                    value={selected.id}
                    onChange={(event) => choose(event.target.value)}
                  >
                    {related.map((location) => (
                      <option key={location.id} value={location.id}>
                        {storageOptionLabel(related, location.id)}
                      </option>
                    ))}
                  </select>
                </label>
                {references.length > 0 ? (
                  <button
                    className="placement-primary"
                    disabled={pending}
                    onClick={() => place(selected.id)}
                  >
                    <MapPin size={17} />
                    Place {references.length === 1 ? "item" : references.length + " items"} here
                  </button>
                ) : (
                  <button
                    className="placement-add"
                    disabled={pending}
                    onClick={() => setAddingAt(addingAt === selected.id ? null : selected.id)}
                  >
                    <Plus size={16} />
                    Add item
                  </button>
                )}
              </div>
              {notice && (
                <p className="placement-notice" role="status">
                  <Check size={16} />
                  {notice}
                  <button aria-label="Dismiss placement message" onClick={() => setNotice("")}>
                    <X size={14} />
                  </button>
                </p>
              )}
              {addingAt === selected.id && (
                <form
                  className="storage-new-item"
                  aria-label="New item at this location"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (pending) return;
                    const values = new FormData(event.currentTarget);
                    const name = String(values.get("name") ?? "").trim(),
                      unitName = String(values.get("unit") ?? "").trim(),
                      quantity = Number(values.get("quantity"));
                    if (!name || !unitName || !Number.isFinite(quantity) || quantity < 0) return;
                    const id = useEditorStore
                      .getState()
                      .addInventoryItemToRoom(room.id, selected.id, {
                        name,
                        unit: unitName,
                        quantity,
                      });
                    if (id) setAddingAt(null);
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
                        required
                        defaultValue="1"
                      />
                    </label>
                    <label>
                      Unit
                      <input name="unit" defaultValue="each" required maxLength={40} />
                    </label>
                  </div>
                  <button type="submit" disabled={pending}>
                    Create item here
                  </button>
                  <button type="button" onClick={() => setAddingAt(null)}>
                    Cancel
                  </button>
                </form>
              )}
              <div className="placement-contents" role="region" aria-label="Assigned inventory">
                {contents.map((item) => (
                  <article key={item.id}>
                    <InventoryThumbnail item={item} />
                    <button aria-label={item.name} onClick={() => onOpenItem(room.id, item.id)}>
                      <b>{item.name}</b>
                      <small>
                        {item.quantity} {item.unit}
                        {item.storageLocationId !== selected.id &&
                          " · " +
                            (related.find((entry) => entry.id === item.storageLocationId)?.name ??
                              "")}
                      </small>
                    </button>
                    <button
                      title="Select this item to move it"
                      aria-label={"Move " + item.name}
                      onClick={() => {
                        setChosen([{ roomId: room.id, itemId: item.id }]);
                        setQuery("");
                        setScope("all");
                        itemSearch.current?.focus();
                      }}
                    >
                      <MapPin size={17} />
                    </button>
                  </article>
                ))}
                {!contents.length && (
                  <p>
                    Empty location. Drop an item here, or select one on the left and choose{" "}
                    <b>Place here</b>.
                  </p>
                )}
              </div>
              <div className="placement-secondary-tools">
                <button
                  onClick={() => {
                    const state = useEditorStore.getState();
                    if (state.project.activeRoomId !== room.id) state.switchRoom(room.id);
                    state.setSelectedLocation(selected.id);
                    state.setPanel("index");
                    navigateWorkspace("/");
                  }}
                >
                  Show this location in layout <ArrowRight size={14} />
                </button>
              </div>
              <AdvancedStorage
                key={selected.id + ":" + selected.updatedAt}
                room={room}
                location={selected}
                onChoose={choose}
              />
              {missing > 0 && (
                <details className="placement-setup">
                  <summary>Set up missing storage</summary>
                  <p>
                    Add records for this room's physical drawers and shelves. Existing names and
                    inventory stay unchanged.
                  </p>
                  <button
                    disabled={pending}
                    onClick={() => useEditorStore.getState().completeRoomStorage(room.id)}
                  >
                    Complete room storage
                  </button>
                </details>
              )}
            </section>
          </div>
        ) : (
          <div className="placement-empty">
            <Archive size={36} />
            <h2>No storage furniture yet</h2>
            <p>Add a cabinet or storage bench in the Layout Editor.</p>
          </div>
        )}
      </section>
    </section>
  );
}
