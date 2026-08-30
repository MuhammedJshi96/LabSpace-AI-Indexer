import {
  Archive,
  ArrowRight,
  CaretRight,
  Check,
  MagnifyingGlass,
  MapPin,
  Package,
  PencilSimple,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getAssetDefinition } from "../domain/assets";
import { storagePath, type InventoryReference } from "../domain/inventory-organization";
import { useEditorStore } from "../store/editor-store";
import { AssetThumbnail } from "./AssetThumbnail";
import "./InventoryOrganizer.css";

function OrganizerDialog({
  title,
  subtitle,
  onClose,
  children,
  compact = false,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    const input = dialog?.querySelector("input");
    input?.focus();
    if (input && compact) input.select();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [compact]);
  return createPortal(
    <dialog
      ref={ref}
      className={`inventory-organizer ${compact ? "is-compact" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="organizer-header">
        <div>
          <span className="eyebrow">Inventory & storage</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button
          type="button"
          className="organizer-icon-button"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}

export function StorageRenameDialog({
  roomId,
  locationId,
  onClose,
}: {
  roomId: string;
  locationId: string;
  onClose: () => void;
}) {
  const project = useEditorStore((state) => state.project);
  const rename = useEditorStore((state) => state.renameStorageLocation);
  const room = project.rooms.find((entry) => entry.id === roomId);
  const location = room?.scene.storageLocations.find((entry) => entry.id === locationId);
  const [name, setName] = useState(location?.name ?? "");
  const [error, setError] = useState("");
  return (
    <OrganizerDialog
      compact
      title={`Rename ${location?.type ?? "storage"}`}
      subtitle="Use a name that makes sense to your team."
      onClose={onClose}
    >
      <form
        className="storage-rename-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (rename(roomId, locationId, name)) onClose();
          else setError("The name could not be saved. Check the location and try again.");
        }}
      >
        <div className="organizer-address">
          <MapPin size={19} />
          <span>
            {room?.name} /{" "}
            {room
              ? storagePath(room.scene.storageLocations, locationId)
                  .map((entry) => entry.name)
                  .join(" / ")
              : "Location unavailable"}
          </span>
        </div>
        <label className="organizer-field">
          <span>Storage name</span>
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            placeholder="For example: Student supplies"
          />
        </label>
        <p className="organizer-help">
          Your name appears in Inventory, Spatial Index and WebMCP. The location code, assigned
          items and opening mechanism stay unchanged.
        </p>
        {error && (
          <p role="alert" className="organizer-error">
            {error}
          </p>
        )}
        <footer className="organizer-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-action" disabled={!location || !name.trim()} type="submit">
            <Check size={17} />
            Save name
          </button>
        </footer>
      </form>
    </OrganizerDialog>
  );
}

export type InventoryOrganizerOptions = {
  mode?: "assign" | "names";
  initialItems?: InventoryReference[];
  initialRoomId?: string;
  initialLocationId?: string | null;
};

export function InventoryOrganizer({
  mode = "assign",
  initialItems = [],
  initialRoomId,
  initialLocationId,
  onClose,
}: InventoryOrganizerOptions & { onClose: () => void }) {
  const project = useEditorStore((state) => state.project);
  const assign = useEditorStore((state) => state.assignInventoryItems);
  const rooms = project.rooms.filter((room) => room.roomKind !== "demo-template");
  const [roomId, setRoomId] = useState(initialRoomId ?? project.activeRoomId);
  const [locationId, setLocationId] = useState(initialLocationId ?? null);
  const [chosen, setChosen] = useState(Boolean(initialLocationId));
  const room = rooms.find((entry) => entry.id === roomId) ?? rooms[0];
  const locations = room?.scene.storageLocations ?? [];
  const [parentId, setParentId] = useState<string | null>(
    locations.find((entry) => entry.id === initialLocationId)?.parentId ?? null,
  );
  const [query, setQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [selected, setSelected] = useState<InventoryReference[]>(initialItems);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selectedLocation = locations.find((entry) => entry.id === locationId);
  const object = room?.scene.objects.find((entry) => entry.id === selectedLocation?.objectId);
  const laboratory = project.laboratories.find((entry) => entry.id === room?.laboratoryId);
  const path = storagePath(locations, locationId);
  const browsePath = storagePath(locations, parentId);
  const term = query.trim().toLocaleLowerCase();
  const visibleLocations = locations
    .filter((location) =>
      term
        ? [...storagePath(locations, location.id).map((entry) => entry.name), location.indexCode]
            .join(" ")
            .toLocaleLowerCase()
            .includes(term)
        : location.parentId === parentId,
    )
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const allItems = rooms.flatMap((entry) =>
    entry.scene.inventoryItems.map((item) => ({ room: entry, item })),
  );
  const visibleItems = allItems.filter(({ room: entry, item }) =>
    [
      item.name,
      item.owner,
      entry.name,
      entry.code,
      ...storagePath(entry.scene.storageLocations, item.storageLocationId).map(
        (location) => location.name,
      ),
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(itemQuery.trim().toLocaleLowerCase()),
  );
  const isSelected = (reference: InventoryReference) =>
    selected.some(
      (entry) => entry.itemId === reference.itemId && entry.roomId === reference.roomId,
    );
  const toggle = (reference: InventoryReference) =>
    setSelected((entries) =>
      isSelected(reference)
        ? entries.filter(
            (entry) => entry.itemId !== reference.itemId || entry.roomId !== reference.roomId,
          )
        : [...entries, reference],
    );
  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every(({ room: entry, item }) =>
      isSelected({ roomId: entry.id, itemId: item.id }),
    );
  const choose = (id: string | null) => {
    setLocationId(id);
    setChosen(true);
    setError("");
  };
  const browse = (id: string | null) => {
    setParentId(id);
    setQuery("");
    if (id) choose(id);
  };
  const destination = room
    ? [laboratory?.name, `${room.name} · ${room.code}`, ...path.map((entry) => entry.name)]
        .filter(Boolean)
        .join(" → ")
    : "Choose a room";

  return (
    <>
      <OrganizerDialog
        title={mode === "names" ? "Storage names" : "Assign inventory"}
        subtitle={
          mode === "names"
            ? "Browse your storage and give each place a recognizable name."
            : "Select items, choose their physical location, and assign them together."
        }
        onClose={onClose}
      >
        <div className={`organizer-body ${mode === "names" ? "names-only" : ""}`}>
          {mode === "assign" && (
            <section className="organizer-items" aria-label="Items to assign">
              <div className="organizer-section-heading">
                <Package size={19} />
                <b>Choose items</b>
                <span>{selected.length} selected</span>
              </div>
              <label className="organizer-search">
                <MagnifyingGlass size={18} />
                <input
                  aria-label="Search inventory to assign"
                  placeholder="Find an item…"
                  value={itemQuery}
                  onChange={(event) => setItemQuery(event.target.value)}
                />
              </label>
              <label className="organizer-select-all">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() =>
                    setSelected((entries) =>
                      allVisibleSelected
                        ? entries.filter(
                            (entry) =>
                              !visibleItems.some(
                                ({ room: r, item }) =>
                                  r.id === entry.roomId && item.id === entry.itemId,
                              ),
                          )
                        : [
                            ...entries,
                            ...visibleItems
                              .filter(
                                ({ room: r, item }) =>
                                  !isSelected({ roomId: r.id, itemId: item.id }),
                              )
                              .map(({ room: r, item }) => ({ roomId: r.id, itemId: item.id })),
                          ],
                    )
                  }
                />
                Select visible items <small>{visibleItems.length}</small>
              </label>
              <div className="organizer-item-list">
                {visibleItems.map(({ room: entry, item }) => (
                  <label
                    key={`${entry.id}/${item.id}`}
                    className={`organizer-item ${isSelected({ roomId: entry.id, itemId: item.id }) ? "is-selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.name} in ${entry.code}`}
                      checked={isSelected({ roomId: entry.id, itemId: item.id })}
                      onChange={() => toggle({ roomId: entry.id, itemId: item.id })}
                    />
                    <span>
                      <b>{item.name}</b>
                      <small>
                        {entry.name} · {entry.code}
                      </small>
                      <em>
                        {item.quantity} {item.unit} ·{" "}
                        {item.storageLocationId ? "Already assigned" : "No location yet"}
                      </em>
                    </span>
                  </label>
                ))}
                {!visibleItems.length && (
                  <p className="organizer-empty">
                    No items match. Create an inventory item first or try another search.
                  </p>
                )}
              </div>
            </section>
          )}
          <section className="organizer-locations" aria-label="Choose storage location">
            <div className="organizer-section-heading">
              <MapPin size={19} />
              <b>{mode === "names" ? "Browse storage" : "Choose a destination"}</b>
            </div>
            <div className="organizer-location-filters">
              <label className="organizer-field">
                <span>Laboratory / room</span>
                <select
                  aria-label="Destination room"
                  value={room?.id ?? ""}
                  onChange={(event) => {
                    setRoomId(event.target.value);
                    setLocationId(null);
                    setChosen(false);
                    setParentId(null);
                    setQuery("");
                  }}
                >
                  {project.laboratories.map((lab) => (
                    <optgroup key={lab.id} label={lab.name}>
                      {rooms
                        .filter((entry) => entry.laboratoryId === lab.id)
                        .map((entry) => (
                          <option value={entry.id} key={entry.id}>
                            {entry.name} · {entry.code}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="organizer-search">
                <MagnifyingGlass size={18} />
                <input
                  aria-label="Search storage names"
                  placeholder="Search cabinet, shelf or drawer…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <nav className="organizer-breadcrumbs" aria-label="Storage browsing path">
              <button type="button" onClick={() => browse(null)}>
                All storage
              </button>
              {browsePath.map((entry) => (
                <span key={entry.id}>
                  <CaretRight size={14} />
                  <button type="button" onClick={() => browse(entry.id)}>
                    {entry.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="organizer-location-list">
              {visibleLocations.map((location) => {
                const children = locations.filter((entry) => entry.parentId === location.id);
                const contents =
                  room?.scene.inventoryItems.filter(
                    (item) => item.storageLocationId === location.id,
                  ).length ?? 0;
                return (
                  <button
                    type="button"
                    key={location.id}
                    className={`organizer-location ${locationId === location.id ? "is-selected" : ""}`}
                    aria-label={`Choose ${location.name}`}
                    aria-pressed={locationId === location.id}
                    onClick={() => {
                      choose(location.id);
                      if (children.length) browse(location.id);
                      else if (term) {
                        setParentId(location.parentId);
                        setQuery("");
                      }
                    }}
                  >
                    <Archive size={21} weight="duotone" />
                    <span>
                      <b>{location.name}</b>
                      <small>
                        {term
                          ? storagePath(locations, location.id)
                              .slice(0, -1)
                              .map((entry) => entry.name)
                              .join(" / ")
                          : `${location.type} · ${contents} assigned ${contents === 1 ? "item" : "items"}`}
                      </small>
                      <code>{location.indexCode}</code>
                    </span>
                    {children.length ? (
                      <span className="organizer-child-count">
                        {children.length}
                        <CaretRight size={17} />
                      </span>
                    ) : locationId === location.id ? (
                      <Check size={19} />
                    ) : null}
                  </button>
                );
              })}
              {!visibleLocations.length && (
                <p className="organizer-empty">
                  {term
                    ? "No matching storage names. Try a shorter search."
                    : parentId
                      ? "This is an exact storage location. You can use it or return to its parent."
                      : "No storage is set up in this room. Add a cabinet or complete its storage in the Layout Editor."}
                </p>
              )}
            </div>
            <div className="organizer-location-summary">
              {object && (
                <span className="organizer-asset">
                  <AssetThumbnail asset={getAssetDefinition(object.assetDefinitionId)} />
                </span>
              )}
              <div>
                <small>
                  {selectedLocation ? `Selected ${selectedLocation.type}` : "Selected destination"}
                </small>
                <b>
                  {selectedLocation?.name ??
                    (chosen ? "Unassigned in this room" : "Choose a location above")}
                </b>
                {selectedLocation && (
                  <button
                    type="button"
                    className="organizer-rename"
                    onClick={() => setRenameId(selectedLocation.id)}
                  >
                    <PencilSimple size={15} />
                    Rename {selectedLocation.type}
                  </button>
                )}
              </div>
              {mode === "assign" && (
                <button type="button" className="organizer-unassigned" onClick={() => choose(null)}>
                  Leave unassigned
                </button>
              )}
            </div>
          </section>
        </div>
        <footer className="organizer-footer">
          <div className="organizer-final-address">
            <small>
              {mode === "assign"
                ? `${selected.length} ${selected.length === 1 ? "item" : "items"} → ${chosen ? "destination" : "choose a destination"}`
                : "Storage address"}
            </small>
            <b>{destination}</b>
            {error && (
              <p role="alert" className="organizer-error">
                {error}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose}>
            {mode === "names" ? "Done" : "Cancel"}
          </button>
          {mode === "assign" && (
            <button
              type="button"
              className="primary-action"
              disabled={!room || !chosen || !selected.length}
              onClick={() => {
                if (assign(selected, room!.id, locationId)) onClose();
                else
                  setError(
                    "The assignment could not be completed. Check your selection or any pending agent preview.",
                  );
              }}
            >
              Assign {selected.length || ""} {selected.length === 1 ? "item" : "items"}
              <ArrowRight size={17} />
            </button>
          )}
        </footer>
      </OrganizerDialog>
      {renameId && room && (
        <StorageRenameDialog
          roomId={room.id}
          locationId={renameId}
          onClose={() => setRenameId(null)}
        />
      )}
    </>
  );
}
