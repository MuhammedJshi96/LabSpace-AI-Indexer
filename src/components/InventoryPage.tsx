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
  CaretRight,
  ArrowLeft,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InventoryItem, Room, StorageLocation } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { Dialogs, Toasts } from "./Dialogs";
import { TopBar } from "./TopBar";
import { InventoryThumbnail } from "./InventoryThumbnail";
import { InventoryImageEditor } from "./InventoryImageEditor";
import { StorageNameEditor } from "./StorageNameEditor";
import { storagePath, type InventoryReference } from "../domain/inventory-organization";
import { compactStorageLabel } from "../domain/storage-display";
import { StorageWorkspace, type StorageSelection } from "./StorageWorkspace";
import { navigateWorkspace } from "../lib/workspace-navigation";
import "./InventoryPage.css";

type InventoryRow = {
  room: Room;
  item: InventoryItem;
  laboratoryName: string;
  laboratoryCode: string;
  location: StorageLocation | null;
  path: StorageLocation[];
};

function locationPath(room: Room, locationId: string | null) {
  return storagePath(room.scene.storageLocations, locationId);
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
  const [editingItem, setEditingItem] = useState(false);
  const [placementItems, setPlacementItems] = useState<InventoryReference[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailDialog = useRef<HTMLDialogElement>(null);
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
    if (detailOpen) detailDialog.current?.showModal();
  }, [detailOpen]);
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
          ...row.path.map((location) => location.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term))
    );
  });
  // Keep the dossier on its explicit record while an edit changes the active
  // search/filter match; never redirect subsequent keystrokes to another item.
  const selected =
    (editingItem ? rows : filteredRows).find((row) => row.item.id === selectedItemId) ??
    filteredRows[0] ??
    null;
  const openStorageAt = (row: InventoryRow | null) =>
    changeView(
      "storage",
      row?.location
        ? {
            roomId: row.room.id,
            objectId: row.location.objectId,
            locationId: row.location.id,
          }
        : { roomId: row?.room.id ?? project.activeRoomId, objectId: null, locationId: null },
    );
  const startPlacement = (items: InventoryReference[] = []) => {
    const firstSelected = items.length
      ? rows.find((row) => row.room.id === items[0].roomId && row.item.id === items[0].itemId)
      : selected;
    setPlacementItems(items);
    setDetailOpen(false);
    openStorageAt(firstSelected ?? null);
  };
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
      setEditingItem(true);
      setDetailOpen(true);
      setQuery("");
      setRoomFilter("all");
      setStatusFilter("all");
    }
  };

  return (
    <div className="app-shell inventory-page-shell studio-refined studio-simple">
      <TopBar activeArea="inventory" contextLabel="Inventory Studio" />
      <main
        className={`inventory-studio has-workspace-tabs${view === "storage" ? " is-storage-view" : ""}`}
      >
        <header className="inventory-studio-header">
          <div>
            <span className="eyebrow">LabSpace / Resources</span>
            <h1>{view === "storage" ? "Storage workspace" : "Inventory Studio"}</h1>
            <p>
              {view === "storage"
                ? "Choose a cabinet. Drop items into place."
                : "Find your stock. Open an item to edit it, or place it in storage."}
            </p>
          </div>
          {view === "inventory" && (
            <div className="inventory-create-control">
              <button className="inventory-secondary-action" onClick={() => startPlacement()}>
                <MapPin size={17} />
                Assign inventory
              </button>
              <button className="primary-action" onClick={createItem}>
                <Plus size={17} /> New inventory item
              </button>
            </div>
          )}
          {view === "storage" && (
            <button className="inventory-secondary-action" onClick={() => navigateWorkspace("/")}>
              <ArrowLeft size={17} /> Back to layout
            </button>
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
                  startPlacement();
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
              onClick={() => startPlacement()}
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
          <span className="studio-scope">
            <Buildings size={15} /> {project.laboratories.length}{" "}
            {project.laboratories.length === 1 ? "laboratory" : "laboratories"}
            <span>·</span>
            {editableRooms.length} rooms
          </span>
          <div className="inventory-workspace-history">
            <button
              aria-label={view === "storage" ? "Undo last storage change" : "Undo last change"}
              disabled={!canUndo}
              onClick={undo}
            >
              <ArrowCounterClockwise size={16} /> Undo
            </button>
            <button
              aria-label={view === "storage" ? "Redo last storage change" : "Redo last change"}
              disabled={!canRedo}
              onClick={redo}
            >
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
              initialItems={placementItems}
              onAssigned={() => {
                setChecked([]);
                setPlacementItems([]);
              }}
              onSelection={(value) => changeView("storage", value)}
              onOpenItem={(_roomId, itemId) => {
                setSelectedItemId(itemId);
                setEditingItem(false);
                setDetailOpen(true);
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
            <div className="inventory-ledger">
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
                  <select
                    aria-label="Location filter"
                    value={roomFilter}
                    onChange={(event) => setRoomFilter(event.target.value)}
                  >
                    <option value="all">All locations</option>
                    {project.laboratories.map((laboratory) => (
                      <optgroup
                        key={laboratory.id}
                        label={`${laboratory.name} · ${laboratory.code}`}
                      >
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
                    <Funnel size={15} /> Status
                  </span>
                  {(["all", "indexed", "unassigned", "expired"] as const).map((status) => (
                    <button
                      key={status}
                      className={statusFilter === status ? "active" : ""}
                      aria-pressed={statusFilter === status}
                      onClick={() => setStatusFilter(status)}
                    >
                      <span>
                        {status === "indexed"
                          ? "Located"
                          : status === "unassigned"
                            ? "Needs a place"
                            : status[0].toUpperCase() + status.slice(1)}
                      </span>
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
                    <span>{checked.length ? `${checked.length} selected` : "Select all"}</span>
                  </label>
                  {checked.length > 0 ? (
                    <>
                      {hiddenChecked > 0 && <small>{hiddenChecked} hidden by filters</small>}
                      <button className="inventory-clear-selection" onClick={() => setChecked([])}>
                        Clear selection
                      </button>
                      <button
                        className="inventory-bulk-assign"
                        onClick={() => startPlacement(checked)}
                      >
                        <MapPin size={16} />
                        Assign selected ({checked.length})
                      </button>
                    </>
                  ) : (
                    <small className="studio-record-count">
                      {filteredRows.length} {filteredRows.length === 1 ? "record" : "records"}
                      {filteredRows.length !== rows.length && ` of ${rows.length}`}
                    </small>
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
                        className={`inventory-registry-row ${detailOpen && selected?.item.id === row.item.id ? "is-selected" : ""} ${isChecked(row) ? "is-checked" : ""}`}
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
                          aria-label={[
                            row.item.name,
                            row.room.name,
                            row.room.code,
                            row.path.map((location) => location.name).join(" / "),
                            `${row.item.quantity} ${row.item.unit}`,
                            status === "indexed"
                              ? "Located"
                              : status === "unassigned"
                                ? "Needs a place"
                                : "Expired",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-pressed={detailOpen && selected?.item.id === row.item.id}
                          onClick={() => {
                            setSelectedItemId(row.item.id);
                            setEditingItem(false);
                            setDetailOpen(true);
                          }}
                        >
                          <InventoryThumbnail item={row.item} />
                          <span className="inventory-record-copy">
                            <b>{row.item.name}</b>
                            <small>
                              {row.room.name}{" "}
                              <span className="inventory-room-code">{row.room.code}</span>
                            </small>
                            <em
                              className="inventory-location-breadcrumb"
                              title={row.path.map((location) => location.name).join(" → ")}
                            >
                              {row.path.length ? (
                                row.path.slice(-2).map((location, index) => (
                                  <span key={location.id}>
                                    <span>{compactStorageLabel(location.name, location.type)}</span>
                                    {index < Math.min(row.path.length, 2) - 1 && (
                                      <CaretRight size={11} aria-hidden />
                                    )}
                                  </span>
                                ))
                              ) : (
                                <span>Location not assigned</span>
                              )}
                            </em>
                          </span>
                          <strong className="inventory-stock">
                            <span>{row.item.quantity}</span>
                            <small>{row.item.unit}</small>
                          </strong>
                          <span className={`inventory-record-status ${status}`}>
                            {status === "indexed"
                              ? "Located"
                              : status === "unassigned"
                                ? "Needs a place"
                                : "Expired"}
                          </span>
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
            </div>

            {detailOpen && (
              <dialog
                ref={detailDialog}
                className="inventory-detail-dialog"
                aria-label="Inventory item details"
                onCancel={() => setDetailOpen(false)}
              >
                <button
                  className="inventory-detail-close"
                  aria-label="Close item details"
                  onClick={() => setDetailOpen(false)}
                >
                  <X size={20} />
                </button>
                <aside className="inventory-detail-panel" aria-label="Selected inventory item">
                  {selected ? (
                    <>
                      <header>
                        <InventoryThumbnail item={selected.item} />
                        <span>
                          <small>Inventory record</small>
                          <h2>{selected.item.name}</h2>
                          <span className={`studio-record-state ${statusFor(selected.item)}`}>
                            <span />
                            {statusFor(selected.item) === "indexed"
                              ? "Located in your laboratory"
                              : statusFor(selected.item) === "expired"
                                ? "Expiry needs review"
                                : "Location not assigned"}
                          </span>
                        </span>
                      </header>
                      <div className="studio-item-tabs" role="group" aria-label="Item view">
                        <button aria-pressed={!editingItem} onClick={() => setEditingItem(false)}>
                          Overview
                        </button>
                        <button
                          aria-pressed={editingItem}
                          onClick={() => {
                            setSelectedItemId(selected.item.id);
                            setEditingItem(true);
                          }}
                        >
                          <PencilSimple size={14} />
                          Edit item details
                        </button>
                      </div>
                      <div className="inventory-dossier-scroll">
                        {!editingItem && (
                          <>
                            <section className="studio-stock-fact" aria-label="Recorded stock">
                              <span>Recorded stock</span>
                              <strong>
                                {selected.item.quantity} <small>{selected.item.unit}</small>
                              </strong>
                              <Package size={21} />
                              <small>As recorded in your inventory</small>
                            </section>
                            <section className="studio-address" aria-label="Exact location">
                              <header>
                                <MapPin size={17} />
                                <h3>Where to find it</h3>
                              </header>
                              <ol>
                                <li>
                                  <small>Laboratory</small>
                                  <b>{selected.laboratoryName}</b>
                                </li>
                                <li>
                                  <small>Room · {selected.room.code}</small>
                                  <b>{selected.room.name}</b>
                                </li>
                                {selected.path.map((location, index) => (
                                  <li
                                    key={location.id}
                                    className={
                                      index === selected.path.length - 1
                                        ? "address-destination"
                                        : ""
                                    }
                                  >
                                    <small>
                                      {index === 0
                                        ? "Storage unit"
                                        : index === selected.path.length - 1
                                          ? "Exact location"
                                          : "Inside"}
                                    </small>
                                    <b title={location.name}>
                                      {compactStorageLabel(location.name, location.type)}
                                    </b>
                                  </li>
                                ))}
                              </ol>
                              {!selected.location && (
                                <p className="studio-address-empty">
                                  Give this item a home to find it in the spatial index.
                                </p>
                              )}
                              {selected.location && (
                                <button
                                  className="studio-storage-link"
                                  onClick={() => {
                                    setDetailOpen(false);
                                    changeView("storage", {
                                      roomId: selected.room.id,
                                      objectId: selected.location?.objectId,
                                      locationId: selected.location?.id,
                                    });
                                  }}
                                >
                                  <Archive size={16} />
                                  Manage this storage
                                  <ArrowRight size={15} />
                                </button>
                              )}
                            </section>
                          </>
                        )}
                        {editingItem && (
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
                            <InventoryImageEditor
                              key={selected.item.id}
                              source={selected.item.imageSrc}
                              itemName={selected.item.name}
                              onChange={(imageSrc) =>
                                updateItem(selected.room.id, selected.item.id, { imageSrc })
                              }
                            />
                            {selected.location && (
                              <details
                                className="inventory-storage-names wide"
                                key={selected.location.id}
                              >
                                <summary>
                                  <PencilSimple size={15} /> Name this storage
                                </summary>
                                <p>
                                  Edit the labels along this item's address. Codes and contents stay
                                  unchanged.
                                </p>
                                {storagePath(
                                  selected.room.scene.storageLocations,
                                  selected.location.id,
                                ).map((location) => (
                                  <div key={location.id}>
                                    <small>{location.type}</small>
                                    <StorageNameEditor
                                      roomId={selected.room.id}
                                      locationId={location.id}
                                    />
                                  </div>
                                ))}
                              </details>
                            )}
                            <details
                              className="inventory-extra-details wide"
                              key={`details-${selected.item.id}`}
                            >
                              <summary>
                                More details <small>Owner, expiry & notes</small>
                              </summary>
                              <label className="wide">
                                <span>Owner</span>
                                <input
                                  value={selected.item.owner}
                                  placeholder="Shared or responsible person"
                                  onChange={(event) =>
                                    updateItem(selected.room.id, selected.item.id, {
                                      owner: event.target.value,
                                    })
                                  }
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
                              <p className="inventory-canonical-code">
                                Location code{" "}
                                <code>{selected.location?.indexCode ?? "Not assigned"}</code>
                              </p>
                            </details>
                            <button
                              className="studio-delete-record wide"
                              onClick={() => {
                                if (
                                  !window.confirm(`Delete “${selected.item.name}” from inventory?`)
                                )
                                  return;
                                removeItem(selected.room.id, selected.item.id);
                                setSelectedItemId(null);
                                setEditingItem(false);
                              }}
                            >
                              <Trash size={15} />
                              Delete record
                            </button>
                          </div>
                        )}
                      </div>
                      <footer>
                        <button
                          className="studio-address-action"
                          onClick={() =>
                            startPlacement([{ roomId: selected.room.id, itemId: selected.item.id }])
                          }
                        >
                          <MapPin size={16} />
                          {selected.location ? "Change location" : "Choose location"}
                          <CaretRight size={16} />
                        </button>
                        <button
                          onClick={() => {
                            switchRoom(selected.room.id);
                            navigateWorkspace("/");
                          }}
                        >
                          Open room <ArrowRight size={16} />
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
              </dialog>
            )}
          </section>
        )}
      </main>
      <Dialogs />
      <Toasts />
    </div>
  );
}
