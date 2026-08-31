import { create } from "zustand";
import { normalizeRenderQuality, type RenderQuality } from "../domain/render-quality";

export const RENDER_SETTINGS_KEY = "labspace-render-settings-v1";
type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): PreferenceStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function savedQuality(storage?: PreferenceStorage): RenderQuality {
  try {
    const saved = JSON.parse(storage?.getItem(RENDER_SETTINGS_KEY) ?? "null");
    return normalizeRenderQuality(saved?.version === 1 ? saved.quality : undefined);
  } catch {
    return "balanced";
  }
}

export function createRenderSettingsStore(
  storage: PreferenceStorage | undefined = browserStorage(),
) {
  return create<{
    quality: RenderQuality;
    preferenceSaved: boolean;
    setQuality: (quality: RenderQuality) => void;
  }>((set) => ({
    quality: savedQuality(storage),
    preferenceSaved: true,
    setQuality: (value) => {
      const quality = normalizeRenderQuality(value);
      let preferenceSaved = false;
      try {
        storage?.setItem(RENDER_SETTINGS_KEY, JSON.stringify({ version: 1, quality }));
        preferenceSaved = Boolean(storage);
      } catch {
        // Rendering controls remain usable when browser storage is unavailable.
        // Never involve project saving, migration, history or room data.
      }
      set({ quality, preferenceSaved });
    },
  }));
}

export const useRenderSettings = createRenderSettingsStore();
