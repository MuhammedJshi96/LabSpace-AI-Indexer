import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { RENDER_QUALITY_OPTIONS, normalizeRenderQuality } from "../domain/render-quality";
import { useRenderSettings } from "../store/render-settings-store";

/** One vocabulary and one local preference across the four 3D workspaces. */
export function RenderQualityControl({ className = "" }: { className?: string }) {
  const { quality, setQuality, preferenceSaved } = useRenderSettings();
  const description = RENDER_QUALITY_OPTIONS.find(
    (option) => option.value === quality,
  )!.description;
  return (
    <div className={`render-quality-control ${className}`} data-quality={quality}>
      <label
        title={`${description} View setting only; saved rooms and finish colors are unchanged.`}
      >
        <span>Quality</span>
        <select
          aria-label="Render quality"
          value={quality}
          onChange={(event) => setQuality(normalizeRenderQuality(event.target.value))}
        >
          {RENDER_QUALITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-label="Restore Balanced rendering"
        title="Restore Balanced lighting and base finish detail; retain corrected clear glass"
        disabled={quality === "balanced"}
        onClick={() => setQuality("balanced")}
      >
        <ArrowCounterClockwise size={15} />
      </button>
      {!preferenceSaved && (
        <span className="render-quality-unsaved" role="status">
          This visit only
        </span>
      )}
    </div>
  );
}
