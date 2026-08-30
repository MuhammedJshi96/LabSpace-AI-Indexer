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
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { InventoryItem, Room, StorageLocation } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { Dialogs, Toasts } from "./Dialogs";
import { TopBar } from "./TopBar";
import { InventoryOrganizer, type InventoryOrganizerOptions } from "./InventoryOrganizer";

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
    rows.find((row) => row.item.id === selectedItemId) ?? filteredRows[0] ?? rows[0] ?? null;

  const createItem = () => {
    const room =
      editableRooms.find((entry) => entry.id === project.activeRoomId) ?? editableRooms[0];
    if (!room) return;
    const id = addItem(room.id, null, { name: "New inventory item", quantity: 1, unit: "item" });
    if (id) setSelectedItemId(id);
  };

  return (
    <div className="app-shell inventory-page-shell">
      <TopBar activeArea="inventory" contextLabel="Inventory Studio" />
      <main className="inventory-studio">
        <header className="inventory-studio-header">
          <div>
            <span className="eyebrow">Project-wide index</span>
            <h1>Inventory Studio</h1>
            <p>
              One shared inventory registry across every laboratory, room, and storage location.
            </p>
          </div>
          <div className="inventory-create-control">
            <button
              className="inventory-secondary-action"
              onClick={() =>
                setOrganizer({
                  mode: "names",
                  initialRoomId: selected?.room.id,
                  initialLocationId: selected?.location?.id,
                })
              }
            >
              <PencilSimple size={17} />
              Storage names
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
                  {project.laboratories.length} laboratories · {rows.length} records
                </small>
              </span>
            </span>
            <button className="primary-action" onClick={createItem}>
              <Plus size={17} /> New inventory item
            </button>
          </div>
        </header>

        <section className="inventory-studio-body">
          <aside className="inventory-filter-rail">
            <label className="inventory-search">
              <MagnifyingGlass size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items, rooms, locations…"
              />
            </label>
            <label>
              <span>
                <Buildings size={15} /> Location filter
              </span>
              <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
                <option value="all">All laboratories and rooms</option>
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
                {rows.length} shared records · {project.laboratories.length} laboratories ·{" "}
                {editableRooms.length} rooms
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
            <div className="inventory-record-scroll">
              {filteredRows.map((row) => {
                const status = statusFor(row.item);
                return (
                  <button
                    key={`${row.room.id}-${row.item.id}`}
                    className={selected?.item.id === row.item.id ? "selected" : ""}
                    onClick={() => setSelectedItemId(row.item.id)}
                  >
                    <span className="inventory-record-icon">
                      <Package size={20} weight="duotone" />
                    </span>
                    <span className="inventory-record-copy">
                      <b>{row.item.name}</b>
                      <small>
                        {row.laboratoryCode} · {row.room.name} · {row.room.code}
                      </small>
                      <em>{row.path.length ? row.path.join(" / ") : "Location not assigned"}</em>
                    </span>
                    <span className={`inventory-record-status ${status}`}>{status}</span>
                    <strong>
                      {row.item.quantity} {row.item.unit}
                    </strong>
                  </button>
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
                  <span className="inventory-detail-mark">
                    <Package size={22} weight="duotone" />
                  </span>
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
                <div className="inventory-detail-form">
                  <label className="wide">
                    <span>Item name</span>
                    <input
                      value={selected.item.name}
                      onChange={(event) =>
                        updateItem(selected.room.id, selected.item.id, { name: event.target.value })
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
                        updateItem(selected.room.id, selected.item.id, { unit: event.target.value })
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
                      Choose a named cabinet, drawer or shelf in any laboratory. The same inventory
                      record moves with you.
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
                      window.location.assign("/");
                    }}
                  >
                    Open room <ArrowRight size={16} />
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (!window.confirm(`Delete “${selected.item.name}” from inventory?`)) return;
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
      </main>
      <Dialogs />
      {organizer && <InventoryOrganizer {...organizer} onClose={() => setOrganizer(null)} />}
      <Toasts />
    </div>
  );
}
