import { Archive, ArrowSquareOut, Package, TreeStructure } from "@phosphor-icons/react";
import { getAssetDefinition } from "../domain/assets";
import { storagePath } from "../domain/inventory-organization";
import { openStorageWorkspace } from "../lib/workspace-navigation";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";
import { AssetThumbnail } from "./AssetThumbnail";
import "./StorageWorkspace.css";

export function StorageInspector() {
  const room = useEditorStore(selectActiveRoom);
  const selectedId = useEditorStore((state) => state.selectedLocationId);
  const objectIds = useEditorStore((state) => state.selectedIds);
  const locations = room.scene.storageLocations;
  const selected =
    locations.find((entry) => entry.id === selectedId) ??
    locations.find((entry) => entry.objectId === objectIds[0] && !entry.parentId);
  const object = room.scene.objects.find((entry) => entry.id === selected?.objectId);
  const related = selected
    ? locations.filter((entry) => entry.objectId === selected.objectId)
    : locations;
  const items = room.scene.inventoryItems.filter((item) =>
    selected?.parentId
      ? item.storageLocationId === selected.id
      : related.some((entry) => entry.id === item.storageLocationId),
  );
  const cabinets = locations.filter((entry) => !entry.parentId).length;
  return (
    <div className="storage-inspector-summary inspector-scroll">
      <header>
        <span className="storage-inspector-image">
          {object ? (
            <AssetThumbnail asset={getAssetDefinition(object.assetDefinitionId)} />
          ) : (
            <Archive size={32} weight="duotone" />
          )}
        </span>
        <div>
          <span className="eyebrow">{selected ? selected.type : "Room storage"}</span>
          <h3>{selected?.name ?? room.name}</h3>
          <p>
            {selected
              ? storagePath(locations, selected.id)
                  .map((entry) => entry.name)
                  .join(" → ")
              : `${cabinets} storage units · ${locations.length} exact locations`}
          </p>
        </div>
      </header>
      <div className="storage-inspector-facts">
        <span>
          <TreeStructure size={17} /> {related.length} locations
        </span>
        <span>
          <Package size={17} /> {items.length} inventory records
        </span>
      </div>
      {items.length > 0 && (
        <p className="storage-inspector-contents">
          {items
            .slice(0, 3)
            .map((item) => item.name)
            .join(" · ")}
          {items.length > 3 ? ` · +${items.length - 3} more` : ""}
        </p>
      )}
      <button
        className="storage-manage-button"
        onClick={() => openStorageWorkspace(room.id, object?.id, selected?.id)}
      >
        <Archive size={19} /> Manage storage <ArrowSquareOut size={18} />
      </button>
      <p className="storage-inspector-hint">
        A full workspace for cabinet maps, naming and inventory assignment. Your layout view stays
        in place.
      </p>
    </div>
  );
}
