import {
  ArrowRight,
  Buildings,
  Funnel,
  MagnifyingGlass,
  MapPin,
  Package,
  Plus,
  PencilSimple,
  ArrowCounterClockwise,
  ArrowClockwise,
  Trash,
  Archive,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { InventoryItem, Room, StorageLocation } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { Dialogs, Toasts } from "./Dialogs";
import { TopBar } from "./TopBar";
import { InventoryOrganizer, type InventoryOrganizerOptions } from "./InventoryOrganizer";
import { InventoryThumbnail } from "./InventoryThumbnail";
import { StorageNameEditor } from "./StorageNameEditor";
import { storagePath, type InventoryReference } from "../domain/inventory-organization";
import { StorageWorkspace, type StorageSelection } from "./StorageWorkspace";
import { navigateWorkspace } from "../lib/workspace-navigation";
import "./InventoryPage.css";

type InventoryRow = {
  room: Room;
  item: InventoryItem;
  laboratoryName: string;
  laboratoryCode: string;
  location: StorageLocation | null;
  path: string[];
};

function locationPath(room: Room, locationId: string | null) {
  if (!locationId) return [];
  const locations = room.scene.storageLocations;
  const names: string[] = [];
  const visited = new Set<string>();
  let current = locations.find((entry) => entry.id === locationId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId
      ? locations.find((entry) => entry.id === current?.parentId)
      : undefined;
  }
  return names;
}

function statusFor(item: InventoryItem) {
  if (!item.storageLocationId) return "unassigned" as const;
  if (item.expiryDate && new Date(item.expiryDate).getTime() < Date.now())
    return "expired" as const;
  return "indexed" as const;
}

export function InventoryPage() {
  const hydrate = useEditorStore((state) => state.hydrate);
  const hydrated = useEditorStore((state) => state.hydrated);
  const saveNow = useEditorStore((state) => state.saveNow);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const dirtyRevision = useEditorStore((state) => state.dirtyRevision);
  const project = useEditorStore((state) => state.project);
  const addItem = useEditorStore((state) => state.addInventoryItemToRoom);
  const updateItem = useEditorStore((state) => state.updateInventoryItemInRoom);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.history.length > 0 && !state.pendingAgentChange);
  const canRedo = useEditorStore((state) => state.future.length > 0 && !state.pendingAgentChange);
  const removeItem = useEditorStore((state) => state.removeInventoryItemFromRoom);
  const switchRoom = useEditorStore((state) => state.switchRoom);
  const [query, setQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "indexed" | "unassigned" | "expired">(
    "all",
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState<InventoryOrganizerOptions | null>(null);
  const [checkedReferences, setChecked] = useState<InventoryReference[]>([]);
  const [view, setView] = useState<"inventory" | "storage">(() =>
    new URLSearchParams(window.location.search).get("view") === "storage" ? "storage" : "inventory",
  );
  const [storageSelection, setStorageSelection] = useState<StorageSelection>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      roomId: params.get("room") ?? project.activeRoomId,
      objectId: params.get("object"),
      locationId: params.get("location"),
    };
  });
  const changeView = (value: "inventory" | "storage", selection = storageSelection) => {
    setView(value);
    setStorageSelection(selection);
    const params = new URLSearchParams();
    if (value === "storage") {
      params.set("view", "storage");
      params.set("room", selection.roomId);
      if (selection.objectId) params.set("object", selection.objectId);
      if (selection.locationId) params.set("location", selection.locationId);
    }
    window.history.replaceState({}, "", `/inventory${params.size ? `?${params}` : ""}`);
  };

  useEffect(() => void hydrate(), [hydrate]);
  useEffect(() => {
    if (!hydrated || saveStatus !== "unsaved" || dirtyRevision === 0) return;
    const timer = window.setTimeout(() => void saveNow(), 900);
    return () => window.clearTimeout(timer);
  }, [dirtyRevision, hydrated, saveNow, saveStatus]);

  const editableRooms = project.rooms.filter((room) => room.roomKind !== "demo-template");
  const rows = useMemo<InventoryRow[]>(
    () =>
      editableRooms.flatMap((room) => {
        const laboratory = project.laboratories.find((entry) => entry.id === room.laboratoryId);
        return room.scene.inventoryItems.map((item) => ({
          room,
          item,
          laboratoryName: laboratory?.name ?? "Laboratory",
          laboratoryCode: laboratory?.code ?? "LAB",
          location:
            room.scene.storageLocations.find((entry) => entry.id === item.storageLocationId) ??
            null,
          path: locationPath(room, item.storageLocationId),
        }));
      }),
    [editableRooms, project.laboratories],
  );
  const filteredRows = rows.filter((row) => {
    const term = query.trim().toLowerCase();
    return (
      (roomFilter === "all" || row.room.id === roomFilter) &&
      (statusFilter === "all" || statusFor(row.item) === statusFilter) &&
      (!term ||
        [
          row.item.name,
          row.item.owner,
          row.room.name,
          row.room.code,
          row.laboratoryName,
          row.laboratoryCode,
          row.location?.indexCode,
          ...row.path,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term))
    );
  });
  const selected =
    filteredRows.find((row) => row.item.id === selectedItemId) ?? filteredRows[0] ?? null;
  const checked = checkedReferences.filter((entry) =>
    rows.some((row) => row.room.id === entry.roomId && row.item.id === entry.itemId),
  );
  const isChecked = (row: InventoryRow) =>
    checked.some((entry) => entry.roomId === row.room.id && entry.itemId === row.item.id);
  const allChecked = filteredRows.length > 0 && filteredRows.every(isChecked);
  const hiddenChecked = checked.filter(
    (entry) =>
      !filteredRows.some((row) => row.room.id === entry.roomId && row.item.id === entry.itemId),
  ).length;

  const createItem = () => {
    const room =
      editableRooms.find((entry) => entry.id === project.activeRoomId) ?? editableRooms[0];
    if (!room) return;
    const id = addItem(room.id, null, { name: "New inventory item", quantity: 1, unit: "item" });
    if (id) {
      setSelectedItemId(id);
      setQuery("");
      setRoomFilter("all");
      setStatusFilter("all");
    }
  };

  return (
    <div className="app-shell inventory-page-shell">
      <TopBar activeArea="inventory" contextLabel="Inventory Studio" />
      <main
        className={`inventory-studio has-workspace-tabs${view === "storage" ? " is-storage-view" : ""}`}
      >
        <header className="inventory-studio-header">
          <div>
            <span className="eyebrow">Project-wide index</span>
            <h1>{view === "storage" ? "Storage workspace" : "Inventory Studio"}</h1>
            <p>
              {view === "storage"
                ? "Name every place. See what belongs there. Keep your place in the editor."
                : "One shared inventory registry across every laboratory, room, and storage location."}
            </p>
          </div>
          {view === "inventory" && (
            <div className="inventory-create-control">
              <button
                className="inventory-secondary-action"
                onClick={() =>
                  changeView("storage", {
                    roomId: selected?.room.id ?? project.activeRoomId,
                    objectId: selected?.location?.objectId,
                    locationId: selected?.location?.id,
                  })
                }
              >
                <PencilSimple size={17} />
                Manage storage
              </button>
              <button className="inventory-secondary-action" onClick={() => setOrganizer({})}>
                <MapPin size={17} />
                Assign inventory
              </button>
              <span className="inventory-registry-badge">
                <Buildings size={17} weight="duotone" />
                <span>
                  <b>Universal registry</b>
                  <small>
                    {project.laboratories.length}{" "}
                    {project.laboratories.length === 1 ? "laboratory" : "laboratories"} ·{" "}
                    {rows.length} records
                  </small>
                </span>
              </span>
              <button className="primary-action" onClick={createItem}>
                <Plus size={17} /> New inventory item
              </button>
            </div>
          )}
        </header>
        <div className="inventory-workspace-bar">
          <div role="tablist" aria-label="Inventory workspace views">
            <button
              id="inventory-view-tab"
              role="tab"
              aria-selected={view === "inventory"}
              aria-controls="inventory-view-panel"
              tabIndex={view === "inventory" ? 0 : -1}
              onClick={() => changeView("inventory")}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight", "End"].includes(event.key)) {
                  event.preventDefault();
                  changeView("storage");
                  document.getElementById("storage-view-tab")?.focus();
                }
              }}
            >
              <Package size={18} /> Inventory
            </button>
            <button
              id="storage-view-tab"
              role="tab"
              aria-selected={view === "storage"}
              aria-controls="storage-view-panel"
              tabIndex={view === "storage" ? 0 : -1}
              onClick={() => changeView("storage")}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) {
                  event.preventDefault();
                  changeView("inventory");
                  document.getElementById("inventory-view-tab")?.focus();
                }
              }}
            >
              <Archive size={18} /> Storage
            </button>
          </div>
          <div className="inventory-workspace-history">
            <button aria-label="Undo last storage change" disabled={!canUndo} onClick={undo}>
              <ArrowCounterClockwise size={16} /> Undo
            </button>
            <button aria-label="Redo last storage change" disabled={!canRedo} onClick={redo}>
              <ArrowClockwise size={16} /> Redo
            </button>
          </div>
        </div>
        {view === "storage" ? (
          <div
            id="storage-view-panel"
            role="tabpanel"
            aria-labelledby="storage-view-tab"
            className="storage-view-panel"
          >
            <StorageWorkspace
              selection={storageSelection}
              onSelection={(value) => changeView("storage", value)}
              onOpenItem={(_roomId, itemId) => {
                setSelectedItemId(itemId);
                setQuery("");
                setRoomFilter("all");
                setStatusFilter("all");
                changeView("inventory");
              }}
            />
          </div>
        ) : (
          <section
            id="inventory-view-panel"
            role="tabpanel"
            aria-labelledby="inventory-view-tab"
            className="inventory-studio-body"
          >
            <aside className="inventory-filter-rail">
              <label className="inventory-search">
                <MagnifyingGlass size={18} />
                <input
                  aria-label="Search inventory"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search inventory…"
                />
              </label>
              <label>
                <span>
                  <Buildings size={15} /> Location filter
                </span>
                <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
                  <option value="all">All locations</option>
                  {project.laboratories.map((laboratory) => (
                    <optgroup key={laboratory.id} label={`${laboratory.name} · ${laboratory.code}`}>
                      {editableRooms
                        .filter((room) => room.laboratoryId === laboratory.id)
                        .map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name} · {room.code}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="inventory-status-filters">
                <span>
                  <Funnel size={15} /> Assignment state
                </span>
                {(["all", "indexed", "unassigned", "expired"] as const).map((status) => (
                  <button
                    key={status}
                    className={statusFilter === status ? "active" : ""}
                    onClick={() => setStatusFilter(status)}
                  >
                    <span>{status[0].toUpperCase() + status.slice(1)}</span>
                    <em>
                      {status === "all"
                        ? rows.length
                        : rows.filter((row) => statusFor(row.item) === status).length}
                    </em>
                  </button>
                ))}
              </div>
            </aside>

            <section className="inventory-record-list" aria-label="Inventory records">
              <header>
                <span>
                  <b>{filteredRows.length}</b> matching records
                </span>
                <small>
                  {rows.length} total · {editableRooms.length} rooms
                </small>
                <div className="inventory-history-actions">
                  <button
                    aria-label="Undo last change"
                    title="Undo last change"
                    disabled={!canUndo}
                    onClick={undo}
                  >
                    <ArrowCounterClockwise size={17} />
                  </button>
                  <button
                    aria-label="Redo last change"
                    title="Redo last change"
                    disabled={!canRedo}
                    onClick={redo}
                  >
                    <ArrowClockwise size={17} />
                  </button>
                </div>
              </header>
              <div className={`inventory-selection-bar ${checked.length ? "has-selection" : ""}`}>
                <label>
                  <input
                    type="checkbox"
                    aria-label="Select all matching inventory"
                    checked={allChecked}
                    ref={(node) => {
                      if (node) node.indeterminate = !allChecked && filteredRows.some(isChecked);
                    }}
                    onChange={() =>
                      setChecked((entries) =>
                        allChecked
                          ? entries.filter(
                              (entry) =>
                                !filteredRows.some(
                                  (row) =>
                                    row.room.id === entry.roomId && row.item.id === entry.itemId,
                                ),
                            )
                          : [
                              ...entries,
                              ...filteredRows
                                .filter((row) => !isChecked(row))
                                .map((row) => ({ roomId: row.room.id, itemId: row.item.id })),
                            ],
                      )
                    }
                  />
                  <span>{checked.length ? `${checked.length} selected` : "Select items"}</span>
                </label>
                {checked.length > 0 ? (
                  <>
                    {hiddenChecked > 0 && <small>{hiddenChecked} hidden by filters</small>}
                    <button className="inventory-clear-selection" onClick={() => setChecked([])}>
                      Clear selection
                    </button>
                    <button
                      className="inventory-bulk-assign"
                      onClick={() => setOrganizer({ initialItems: checked })}
                    >
                      <MapPin size={16} />
                      Assign selected ({checked.length})
                    </button>
                  </>
                ) : (
                  <small>Select several records to assign them together.</small>
                )}
              </div>
              <div className="inventory-record-scroll">
                <div className="inventory-column-labels" aria-hidden="true">
                  <span>Item & location</span>
                  <span>Stock</span>
                  <span>State</span>
                </div>
                {filteredRows.map((row) => {
                  const status = statusFor(row.item);
                  return (
                    <div
                      className={`inventory-registry-row ${selected?.item.id === row.item.id ? "is-selected" : ""} ${isChecked(row) ? "is-checked" : ""}`}
                      key={`${row.room.id}-${row.item.id}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.item.name} in ${row.room.code}`}
                        checked={isChecked(row)}
                        onChange={() =>
                          setChecked((entries) =>
                            isChecked(row)
                              ? entries.filter(
                                  (entry) =>
                                    entry.roomId !== row.room.id || entry.itemId !== row.item.id,
                                )
                              : [...entries, { roomId: row.room.id, itemId: row.item.id }],
                          )
                        }
                      />
                      <button
                        className="inventory-record-open"
                        aria-pressed={selected?.item.id === row.item.id}
                        onClick={() => setSelectedItemId(row.item.id)}
                      >
                        <InventoryThumbnail item={row.item} />
                        <span className="inventory-record-copy">
                          <b>{row.item.name}</b>
                          <small>
                            {row.laboratoryCode} · {row.room.name} · {row.room.code}
                          </small>
                          <em title={row.path.join(" → ")}>
                            {row.path.length ? row.path.join(" / ") : "Location not assigned"}
                          </em>
                        </span>
                        <strong className="inventory-stock">
                          <span>{row.item.quantity}</span>
                          <small>{row.item.unit}</small>
                        </strong>
                        <span className={`inventory-record-status ${status}`}>{status}</span>
                      </button>
                    </div>
                  );
                })}
                {!filteredRows.length && (
                  <div className="inventory-empty-state">
                    <Package size={36} weight="duotone" />
                    <b>No matching inventory</b>
                    <span>Adjust the project filters or create a new record.</span>
                  </div>
                )}
              </div>
            </section>

            <aside className="inventory-detail-panel">
              {selected ? (
                <>
                  <header>
                    <InventoryThumbnail item={selected.item} />
                    <span>
                      <small>
                        {selected.laboratoryCode} / {selected.room.code}
                      </small>
                      <h2>{selected.item.name}</h2>
                    </span>
                  </header>
                  <div className="inventory-detail-location">
                    <MapPin size={18} />
                    <span>
                      <small>Exact location</small>
                      <b>{selected.path.length ? selected.path.join(" → ") : "Unassigned"}</b>
                      <em>{selected.location?.indexCode ?? "No canonical location code"}</em>
                    </span>
                  </div>
                  {selected.location && (
                    <details className="inventory-storage-names" key={selected.location.id}>
                      <summary>
                        <PencilSimple size={15} />
                        Name this storage
                      </summary>
                      <p>
                        Edit the labels along this item's address. Codes and contents stay
                        unchanged.
                      </p>
                      {storagePath(selected.room.scene.storageLocations, selected.location.id).map(
                        (location) => (
                          <div key={location.id}>
                            <small>{location.type}</small>
                            <StorageNameEditor roomId={selected.room.id} locationId={location.id} />
                          </div>
                        ),
                      )}
                    </details>
                  )}
                  <div className="inventory-detail-form">
                    <label className="wide">
                      <span>Item name</span>
                      <input
                        value={selected.item.name}
                        onChange={(event) =>
                          updateItem(selected.room.id, selected.item.id, {
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Quantity</span>
                      <input
                        type="number"
                        min="0"
                        value={selected.item.quantity}
                        onChange={(event) =>
                          updateItem(selected.room.id, selected.item.id, {
                            quantity: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Unit</span>
                      <input
                        value={selected.item.unit}
                        onChange={(event) =>
                          updateItem(selected.room.id, selected.item.id, {
                            unit: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="wide">
                      <span>Owner</span>
                      <input
                        value={selected.item.owner}
                        onChange={(event) =>
                          updateItem(selected.room.id, selected.item.id, {
                            owner: event.target.value,
                          })
                        }
                        placeholder="Shared or responsible person"
                      />
                    </label>
                    <div className="inventory-assignment-heading wide">
                      <span className="eyebrow">Physical assignment</span>
                      <p>
                        Choose a named cabinet, drawer or shelf in any laboratory. The same
                        inventory record moves with you.
                      </p>
                    </div>
                    <button
                      className="inventory-choose-location wide"
                      onClick={() =>
                        setOrganizer({
                          initialItems: [{ roomId: selected.room.id, itemId: selected.item.id }],
                          initialRoomId: selected.room.id,
                          initialLocationId: selected.item.storageLocationId,
                        })
                      }
                    >
                      <MapPin size={18} />
                      <span>
                        {selected.location ? "Change location" : "Choose location"}
                        <small>
                          {selected.laboratoryName} · {selected.room.code}
                        </small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                    <label className="wide">
                      <span>Evidence image URL</span>
                      <input
                        type="url"
                        value={selected.item.imageSrc ?? ""}
                        onChange={(event) =>
                          updateItem(selected.room.id, selected.item.id, {
                            imageSrc: event.target.value || undefined,
                          })
                        }
                        placeholder="/images/inventory/example.png"
                      />
                    </label>
                    <label className="wide">
                      <span>Expiry date</span>
                      <input
                        type="date"
                        value={selected.item.expiryDate ?? ""}
                        onChange={(event) =>
                          updateItem(selected.room.id, selected.item.id, {
                            expiryDate: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label className="wide">
                      <span>Notes</span>
                      <textarea
                        rows={4}
                        value={selected.item.notes}
                        onChange={(event) =>
                          updateItem(selected.room.id, selected.item.id, {
                            notes: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <footer>
                    <button
                      onClick={() => {
                        switchRoom(selected.room.id);
                        navigateWorkspace("/");
                      }}
                    >
                      Open room <ArrowRight size={16} />
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (!window.confirm(`Delete “${selected.item.name}” from inventory?`))
                          return;
                        removeItem(selected.room.id, selected.item.id);
                        setSelectedItemId(null);
                      }}
                    >
                      <Trash size={16} /> Delete record
                    </button>
                  </footer>
                </>
              ) : (
                <div className="inventory-empty-state">
                  <Package size={36} />
                  <b>Select an inventory record</b>
                </div>
              )}
            </aside>
          </section>
        )}
      </main>
      <Dialogs />
      {organizer && (
        <InventoryOrganizer
          {...organizer}
          onAssigned={() => setChecked([])}
          onClose={() => setOrganizer(null)}
        />
      )}
      <Toasts />
    </div>
  );
}
