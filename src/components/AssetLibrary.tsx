import { useMemo, useRef, useState } from "react";
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  Funnel,
  ListBullets,
  MagnifyingGlass,
  Star,
} from "@phosphor-icons/react";
import { ASSET_CATALOG, ASSET_CATEGORIES, searchAssets } from "../domain/assets";
import type { AssetCategory } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { AssetThumbnail } from "./AssetThumbnail";

type AssetLibraryProps = {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

type CategoryScope = "all" | "favorites" | "furniture" | "storage" | "equipment" | "fixtures";

const LIBRARY_HIDDEN_ASSET_IDS = new Set(["straight-wall", "half-height-wall"]);
const BROWSABLE_ASSET_COUNT = ASSET_CATALOG.filter(
  (asset) => !LIBRARY_HIDDEN_ASSET_IDS.has(asset.id),
).length;

const categoryTabs: Array<{ id: CategoryScope; label: string; categories: AssetCategory[] }> = [
  { id: "all", label: "All", categories: [] },
  { id: "favorites", label: "Favorites", categories: [] },
  { id: "furniture", label: "Furniture", categories: ["Furniture"] },
  { id: "storage", label: "Storage", categories: ["Storage"] },
  { id: "equipment", label: "Equip.", categories: ["Laboratory equipment"] },
  { id: "fixtures", label: "Fixtures", categories: ["Architecture", "Safety", "Utilities"] },
];

function groupLabel(category: AssetCategory) {
  if (category === "Furniture") return "Lab benches & furniture";
  if (category === "Laboratory equipment") return "Laboratory equipment";
  if (category === "Architecture") return "Doors, windows & architecture";
  if (category === "Safety") return "Safety fixtures";
  if (category === "Utilities") return "Utilities & wash fixtures";
  return category;
}

export function AssetLibrary({
  collapsed: panelCollapsed = false,
  onCollapsedChange,
}: AssetLibraryProps) {
  const search = useEditorStore((state) => state.assetSearch);
  const setSearch = useEditorStore((state) => state.setAssetSearch);
  const favorites = useEditorStore((state) => state.favorites);
  const toggleFavorite = useEditorStore((state) => state.toggleFavorite);
  const addAsset = useEditorStore((state) => state.addAsset);
  const setTool = useEditorStore((state) => state.setTool);
  const pushToast = useEditorStore((state) => state.pushToast);
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("all");
  const [collapsed, setCollapsed] = useState<AssetCategory[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const favoriteIdSet = useMemo(() => new Set(favorites), [favorites]);
  const activeCategory = categoryTabs.find((tab) => tab.id === categoryScope) ?? categoryTabs[0];
  const results = useMemo(() => {
    const matchingAssets = searchAssets(search, activeCategory.categories).filter(
      (asset) => !LIBRARY_HIDDEN_ASSET_IDS.has(asset.id),
    );
    return categoryScope === "favorites"
      ? matchingAssets.filter((asset) => favoriteIdSet.has(asset.id))
      : matchingAssets;
  }, [activeCategory.categories, categoryScope, favoriteIdSet, search]);
  const grouped = useMemo(
    () =>
      new Map(
        ASSET_CATEGORIES.map((category) => [
          category,
          results.filter((asset) => asset.category === category),
        ]),
      ),
    [results],
  );

  if (panelCollapsed) {
    return (
      <aside
        id="asset-library-panel"
        className="asset-library is-collapsed"
        aria-label="Asset library"
      >
        <button
          className="collapsed-panel-rail"
          onClick={() => onCollapsedChange?.(false)}
          aria-label="Expand asset library"
          aria-expanded="false"
          aria-controls="asset-library-panel"
          title="Expand asset library"
        >
          <CaretRight size={18} />
          <span>Assets</span>
        </button>
      </aside>
    );
  }

  return (
    <aside id="asset-library-panel" className="asset-library" aria-label="Asset library">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">Asset library</span>
          <h2>Laboratory assets</h2>
        </div>
        <div className="panel-title-actions">
          <span className="count-pill" title={`${results.length} visible assets`}>
            {results.length}
          </span>
          <button
            className="panel-collapse-button"
            onClick={() => onCollapsedChange?.(true)}
            aria-label="Collapse asset library"
            aria-expanded="true"
            aria-controls="asset-library-panel"
            title="Collapse asset library"
          >
            <CaretLeft size={17} />
          </button>
        </div>
      </div>

      <div className="asset-search-row">
        <label className="search-field">
          <MagnifyingGlass size={18} />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search equipment…"
            aria-label="Search assets"
          />
        </label>
        <button
          onClick={() => {
            setSearch("");
            setCategoryScope("all");
          }}
          title="Clear asset filters"
          aria-label="Clear asset filters"
        >
          <Funnel size={18} />
        </button>
      </div>

      <div className="asset-category-tabs" role="tablist" aria-label="Asset categories">
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={categoryScope === tab.id}
            className={categoryScope === tab.id ? "active" : ""}
            onClick={() => setCategoryScope(tab.id)}
          >
            {tab.id === "favorites" ? `${tab.label} ${favorites.length}` : tab.label}
          </button>
        ))}
      </div>

      <div className="asset-groups">
        {ASSET_CATEGORIES.map((category) => {
          const assets = grouped.get(category) ?? [];
          if (!assets.length) return null;
          const isCollapsed = collapsed.includes(category);
          return (
            <section className="asset-category" key={category}>
              <button
                className="asset-category-heading"
                onClick={() =>
                  setCollapsed(
                    isCollapsed
                      ? collapsed.filter((entry) => entry !== category)
                      : [...collapsed, category],
                  )
                }
                aria-expanded={!isCollapsed}
              >
                <CaretDown size={14} className={isCollapsed ? "collapsed" : ""} />
                <span>{groupLabel(category)}</span>
                <em>{assets.length}</em>
              </button>
              {!isCollapsed && (
                <div className="asset-grid">
                  {assets.map((asset) => {
                    const isFavorite = favoriteIdSet.has(asset.id);
                    return (
                      <article
                        className="asset-card"
                        key={asset.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("application/labspace-asset", asset.id);
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        onDoubleClick={() => {
                          if (asset.objectType === "door" || asset.objectType === "window") {
                            setTool(asset.objectType);
                            pushToast(
                              `Click a wall to place ${asset.shortName.toLowerCase()}.`,
                              "info",
                            );
                          } else addAsset(asset.id);
                        }}
                        title={`${asset.name} — ${asset.defaultDimensions.width} × ${asset.defaultDimensions.depth} × ${asset.defaultDimensions.height} mm. Drag to place.`}
                      >
                        <AssetThumbnail asset={asset} />
                        <button
                          type="button"
                          className={`curate-asset-button${isFavorite ? " active" : ""}`}
                          draggable={false}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavorite(asset.id);
                            pushToast(
                              isFavorite
                                ? `${asset.shortName} removed from favorites.`
                                : `${asset.shortName} added to favorites.`,
                              "success",
                            );
                          }}
                          aria-pressed={isFavorite}
                          aria-label={`${isFavorite ? "Remove" : "Add"} ${asset.name} ${isFavorite ? "from" : "to"} favorites`}
                          title={`${isFavorite ? "Remove from" : "Add to"} favorites`}
                        >
                          <Star size={14} weight={isFavorite ? "fill" : "regular"} />
                        </button>
                        <b>{asset.shortName}</b>
                        <span className="asset-card-dimensions">
                          {asset.defaultDimensions.width} × {asset.defaultDimensions.depth} mm
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {!results.length && categoryScope === "favorites" && (
          <div className="empty-state compact">
            <Star size={24} />
            <b>No favorite assets yet</b>
            <span>Use the star on any asset card to keep it in this quick-access list.</span>
            <button onClick={() => setCategoryScope("all")}>Browse all assets</button>
          </div>
        )}

        {!results.length && categoryScope !== "favorites" && (
          <div className="empty-state compact">
            <MagnifyingGlass size={24} />
            <b>No assets found</b>
            <span>Try another category or a broader search.</span>
            <button onClick={() => setSearch("")}>Clear search</button>
          </div>
        )}
      </div>

      <div className="asset-library-footer" aria-label="Asset library summary">
        <ListBullets size={17} />
        {BROWSABLE_ASSET_COUNT} assets · {favorites.length} favorite
        {favorites.length === 1 ? "" : "s"}
      </div>
    </aside>
  );
}
