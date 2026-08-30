import { Archive, ArrowLeft, Cube, ListBullets } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { getAssetDefinition } from "../domain/assets";
import { buildStorageMap, storageMapMinimumWidth, type StorageFace } from "../domain/storage-map";
import type { Room, SceneObject } from "../domain/schema";
import { AssetThumbnail } from "./AssetThumbnail";
import { StorageNameEditor } from "./StorageNameEditor";

export function StorageMap({
  room,
  object,
  selectedId,
  onChoose,
}: {
  room: Room;
  object: SceneObject;
  selectedId: string | null;
  onChoose: (id: string) => void;
}) {
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
  const position = (slot: (typeof slots)[number]) => ({
    left: `${((slot.x - focusBox.x) / focusBox.width) * 100}%`,
    top: `${((slot.y - focusBox.y) / focusBox.height) * 100}%`,
    width: `${(slot.width / focusBox.width) * 100}%`,
    height: `${(slot.height / focusBox.height) * 100}%`,
  });
  const linkedCount = visible.filter((slot) => slot.location).length;
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
    <section ref={mapElement} className="storage-map" aria-label="Visual storage picker">
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
      {slots.length ? (
        <>
          <div className="storage-map-toolbar">
            <div role="group" aria-label="Cabinet face">
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
            {minimumWidth > 400 && (
              <small className="storage-map-scroll-hint">Detailed map · scroll to explore</small>
            )}
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
                width: `min(100%, calc(var(--storage-map-height, clamp(130px, 22vh, 240px)) * ${(viewWidth * focusBox.width) / (viewHeight * focusBox.height)}))`,
                minWidth: minimumWidth,
                aspectRatio: `${viewWidth * focusBox.width} / ${viewHeight * focusBox.height}`,
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
                    className={`storage-map-slot is-${slot.type} ${selectedId === slot.location?.id ? "is-selected" : ""} ${!slot.location ? "is-unlinked" : ""}`}
                    style={position(slot)}
                  >
                    <span className="storage-map-geometry" aria-hidden="true" />
                    <button
                      type="button"
                      className="storage-map-target"
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
                      {index + 1}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="storage-map-caption">
            <Cube size={15} />
            {container ? "Interior shelves" : "Object-local elevation"} · click a numbered location
          </p>
          <details className="storage-map-legend">
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
