import { Archive, ArrowLeft, Cube, ListBullets } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { getAssetDefinition } from "../domain/assets";
import { compactStorageLabel, storageMapMarker } from "../domain/storage-display";
import { buildStorageMap, storageMapMinimumWidth, type StorageFace } from "../domain/storage-map";
import type { Room, SceneObject } from "../domain/schema";
import { AssetThumbnail } from "./AssetThumbnail";
import { StorageNameEditor } from "./StorageNameEditor";

export function StorageMap({
  room,
  object,
  selectedId,
  onChoose,
  showHeading = true,
  named = false,
  dropEnabled = false,
  onDropItems,
}: {
  room: Room;
  object: SceneObject;
  selectedId: string | null;
  onChoose: (id: string) => void;
  showHeading?: boolean;
  named?: boolean;
  dropEnabled?: boolean;
  onDropItems?: (locationId: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const { slots, faces, unlinked } = buildStorageMap(object, room.scene.storageLocations);
  const selectedSlot = slots.find((slot) => slot.location?.id === selectedId);
  const [faceChoice, setFaceChoice] = useState<{
    selection: string | null;
    face: StorageFace;
  } | null>(null);
  const face =
    (faceChoice?.selection === selectedId ? faceChoice.face : null) ??
    selectedSlot?.face ??
    faces[0] ??
    "front";
  const initialInside =
    selectedSlot && slots.some((slot) => slot.parentKey === selectedSlot.key)
      ? selectedSlot.key
      : (selectedSlot?.parentKey ?? null);
  const [insideChoice, setInsideChoice] = useState<{
    selection: string | null;
    key: string | null;
  } | null>(null);
  const insideKey = insideChoice?.selection === selectedId ? insideChoice.key : initialInside;
  const setInsideKey = (key: string | null, selection = selectedId) =>
    setInsideChoice({ selection, key });
  const container = slots.find((slot) => slot.key === insideKey);
  const visible = slots.filter(
    (slot) =>
      slot.face === face && (container ? slot.parentKey === container.key : !slot.parentKey),
  );
  const root = room.scene.storageLocations.find(
    (location) => location.objectId === object.id && !location.parentId,
  );
  const width =
    face === "left" || face === "right" ? object.dimensions.depth : object.dimensions.width;
  const height = object.dimensions.height;
  const viewWidth = Math.max(1, width);
  const viewHeight = Math.max(1, height);
  const focusBox = container ?? { x: 0, y: 0, width: 1, height: 1 };
  const minimumWidth = storageMapMinimumWidth(visible, viewWidth, viewHeight, focusBox.width);
  const physicalAspect = (viewWidth * focusBox.width) / (viewHeight * focusBox.height);
  const diagramAspect = named ? Math.max(2.2, Math.min(3.8, physicalAspect)) : physicalAspect;
  const position = (slot: (typeof slots)[number]) => {
    // Named diagrams expose the usable space ABOVE a shelf, not a tiny target
    // on the thickness of its board. IDs and authored geometry stay unchanged.
    const previousShelf = visible
      .filter(
        (other) =>
          other.type === "shelf" &&
          other.y < slot.y &&
          other.x < slot.x + slot.width &&
          other.x + other.width > slot.x,
      )
      .sort((a, b) => b.y - a.y)[0];
    const shelfTop = Math.max(
      focusBox.y + focusBox.height * 0.025,
      previousShelf ? previousShelf.y + previousShelf.height : focusBox.y,
    );
    const top = named && slot.type === "shelf" ? Math.min(slot.y, shelfTop) : slot.y;
    const slotHeight = named && slot.type === "shelf" ? slot.y + slot.height - top : slot.height;
    return {
      left: `${((slot.x - focusBox.x) / focusBox.width) * 100}%`,
      top: `${((top - focusBox.y) / focusBox.height) * 100}%`,
      width: `${(slot.width / focusBox.width) * 100}%`,
      height: `${(slotHeight / focusBox.height) * 100}%`,
    };
  };
  const linkedCount = visible.filter((slot) => slot.location).length;
  const selectedLocation = selectedSlot?.location ?? null;
  const selectedItemCount = selectedLocation
    ? room.scene.inventoryItems.filter((item) => item.storageLocationId === selectedLocation.id)
        .length
    : 0;
  const mapElement = useRef<HTMLElement>(null);
  const restoreMapFocus = useRef(false);
  useEffect(() => {
    if (!restoreMapFocus.current) return;
    restoreMapFocus.current = false;
    const map = mapElement.current;
    const target =
      map?.querySelector<HTMLButtonElement>(
        ".storage-map-target[aria-pressed='true']:not(:disabled)",
      ) ?? map?.querySelector<HTMLButtonElement>(".storage-map-target:not(:disabled)");
    target?.focus();
  }, [insideKey, selectedId]);
  const openSlot = (slot: (typeof slots)[number]) => {
    if (slot.location) onChoose(slot.location.id);
    if (slots.some((entry) => entry.parentKey === slot.key)) {
      restoreMapFocus.current = true;
      setInsideKey(slot.key, slot.location?.id ?? selectedId);
    }
  };
  return (
    <section
      ref={mapElement}
      className={`storage-map ${named ? "named-storage-map" : ""} ${dropEnabled ? "accepts-items" : ""}`}
      aria-label="Visual storage picker"
    >
      {showHeading && (
        <header className="storage-map-heading">
          <span className="organizer-asset">
            <AssetThumbnail asset={getAssetDefinition(object.assetDefinitionId)} />
          </span>
          <div>
            <span className="eyebrow">Storage map</span>
            {root && root.id !== selectedId ? (
              <StorageNameEditor key={root.id} roomId={room.id} locationId={root.id} />
            ) : (
              <b>{root?.name ?? object.name}</b>
            )}
            <small>
              {(width / 1000).toFixed(2)} m wide · {(height / 1000).toFixed(2)} m high
            </small>
          </div>
        </header>
      )}
      {slots.length ? (
        <>
          <div className="storage-map-toolbar">
            <span className="storage-map-view-label">
              <b>{container ? "Interior layout" : "Storage elevation"}</b>
              <small>
                {face[0].toUpperCase() + face.slice(1)} face · {visible.length} mapped locations
              </small>
            </span>
            <div role="group" aria-label="Cabinet face" hidden={named && faces.length === 1}>
              {faces.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={face === value}
                  onClick={() => {
                    setFaceChoice({ selection: selectedId, face: value });
                    setInsideKey(null);
                  }}
                >
                  {value[0].toUpperCase() + value.slice(1)} face
                </button>
              ))}
            </div>
            {container && (
              <button
                type="button"
                onClick={() => {
                  restoreMapFocus.current = true;
                  setInsideKey(null);
                }}
              >
                <ArrowLeft size={14} />
                Cabinet overview
              </button>
            )}
          </div>
          <div
            className="storage-map-stage"
            tabIndex={0}
            role="region"
            aria-label="Cabinet face diagram, scroll to explore"
          >
            <div
              className="storage-map-elevation"
              style={{
                width: named
                  ? "min(100%, 620px)"
                  : `min(100%, calc(var(--storage-map-height, clamp(130px, 22vh, 240px)) * ${physicalAspect}))`,
                minWidth: named ? 0 : minimumWidth,
                aspectRatio: diagramAspect,
              }}
            >
              <div className="storage-map-frame" aria-hidden="true" />
              {visible.map((slot, index) => {
                const children = slots.filter((entry) => entry.parentKey === slot.key);
                const count = room.scene.inventoryItems.filter(
                  (item) => item.storageLocationId === slot.location?.id,
                ).length;
                return (
                  <div
                    key={slot.key}
                    className={`storage-map-slot is-${slot.type} ${selectedId === slot.location?.id ? "is-selected" : ""} ${!slot.location ? "is-unlinked" : ""} ${dropEnabled && dropTarget === slot.location?.id ? "is-drop-target" : ""}`}
                    style={position(slot)}
                  >
                    <span className="storage-map-geometry" aria-hidden="true" />
                    <button
                      type="button"
                      className="storage-map-target"
                      onDragOver={(event) => {
                        if (!dropEnabled || !slot.location) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTarget(slot.location.id);
                      }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(event) => {
                        if (!dropEnabled || !slot.location) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setDropTarget(null);
                        onDropItems?.(slot.location.id);
                      }}
                      aria-label={
                        slot.location
                          ? `Select ${slot.location.name} on storage map`
                          : `Unlinked ${slot.type} ${index + 1}`
                      }
                      aria-pressed={Boolean(slot.location && selectedId === slot.location.id)}
                      disabled={!slot.location && !children.length}
                      title={
                        slot.location
                          ? `${slot.location.name} · ${count} assigned items`
                          : "Physical location not linked to a saved record"
                      }
                      onClick={() => openSlot(slot)}
                    >
                      {named ? (
                        <span className="storage-map-number">
                          {slot.location
                            ? storageMapMarker(slot.location.name, slot.location.type, index)
                            : `?${index + 1}`}
                        </span>
                      ) : (
                        index + 1
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {named && (
            <div className={`storage-map-selection ${selectedLocation ? "has-selection" : ""}`}>
              <span className="storage-map-selection-marker">
                {selectedLocation
                  ? storageMapMarker(
                      selectedLocation.name,
                      selectedLocation.type,
                      Math.max(
                        0,
                        visible.findIndex((slot) => slot.location?.id === selectedLocation.id),
                      ),
                    )
                  : "—"}
              </span>
              <span className="storage-map-selection-copy">
                <small>{selectedLocation ? "Selected destination" : "Choose a destination"}</small>
                <b title={selectedLocation?.name}>
                  {selectedLocation
                    ? compactStorageLabel(selectedLocation.name, selectedLocation.type)
                    : "Select a marker in the elevation"}
                </b>
                <em>
                  {selectedLocation
                    ? `${selectedLocation.type} · ${selectedItemCount} ${
                        selectedItemCount === 1 ? "item" : "items"
                      }`
                    : "Full names stay readable here instead of inside small drawers."}
                </em>
              </span>
              {selectedLocation && (
                <code title={selectedLocation.indexCode}>{selectedLocation.indexCode}</code>
              )}
            </div>
          )}
          <p className="storage-map-caption">
            <Cube size={15} />
            {named
              ? dropEnabled
                ? "Drop onto the highlighted drawer or shelf"
                : container
                  ? "Inside the cabinet · click a shelf or drop an item"
                  : "Click a compartment to see its shelves · drag items to place them"
              : `${container ? "Interior shelves" : "Cabinet elevation"} · choose a numbered location`}
          </p>
          <details className="storage-map-legend" hidden={named}>
            <summary>Location names · {visible.length}</summary>
            <div className="storage-map-key" aria-label="Storage map locations">
              {visible.map((slot, index) => (
                <button
                  key={slot.key}
                  type="button"
                  disabled={!slot.location && !slots.some((entry) => entry.parentKey === slot.key)}
                  aria-pressed={Boolean(slot.location && slot.location.id === selectedId)}
                  onClick={() => openSlot(slot)}
                >
                  <span>{index + 1}</span>
                  <b>{slot.location?.name ?? `Unlinked ${slot.type}`}</b>
                  <small>
                    {slot.location
                      ? `${room.scene.inventoryItems.filter((item) => item.storageLocationId === slot.location!.id).length} items`
                      : "Use list"}
                  </small>
                </button>
              ))}
            </div>
          </details>
          {(!linkedCount || unlinked.length > 0) && (
            <p className="storage-map-notice">
              <ListBullets size={16} />
              {unlinked.length
                ? `${unlinked.length} saved locations are not linked to model geometry. `
                : "Some physical locations have no saved record. "}
              Use the storage list to choose these locations. No records are changed automatically.
            </p>
          )}
        </>
      ) : (
        <div className="storage-map-empty">
          <Archive size={32} />
          <b>Choose from the storage list</b>
          <p>
            This asset has no verified storage map. Its named locations are still available in the
            list.
          </p>
        </div>
      )}
    </section>
  );
}
