import { describe, expect, it } from "vitest";
import { normalizeRenderQuality, renderQualityPreset } from "../../src/domain/render-quality";
import {
  createRenderSettingsStore,
  RENDER_SETTINGS_KEY,
} from "../../src/store/render-settings-store";

describe("reversible render quality", () => {
  it("keeps the released Balanced budgets on each surface", () => {
    expect(renderQualityPreset("balanced")).toMatchObject({
      dpr: [1, 1.5],
      shadowSize: 2048,
      softShadows: false,
      environmentMultiplier: 1,
      keyMultiplier: 1,
      contactShadows: true,
    });
    expect(renderQualityPreset("balanced", "studio").shadowSize).toBe(1024);
    expect(renderQualityPreset("balanced", "facility")).toMatchObject({
      shadowSize: 1536,
      dpr: [1, 1.45],
    });
  });

  it("bounds High cost and reduces Low without changing geometry", () => {
    for (const surface of ["room", "studio", "facility"] as const) {
      const low = renderQualityPreset("low", surface);
      const high = renderQualityPreset("high", surface);
      expect(low.shadowSize).toBe(512);
      expect(low.contactShadows).toBe(false);
      expect(low.dpr[1]).toBe(1);
      expect(high.shadowSize).toBeLessThanOrEqual(2048);
      expect(high.dpr[1]).toBeLessThanOrEqual(2);
      expect(high.softShadows).toBe(true);
      expect(Object.keys(high)).not.toContain("visibleAssets");
    }
  });

  it("normalizes legacy names and fails unknown settings to Balanced", () => {
    expect(normalizeRenderQuality("performance")).toBe("low");
    expect(normalizeRenderQuality("detail")).toBe("high");
    for (const value of [null, undefined, "ultra", 1, {}])
      expect(normalizeRenderQuality(value)).toBe("balanced");
  });

  it("remembers quality independently of any room or project save", () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
    };
    const store = createRenderSettingsStore(storage);
    expect(store.getState().quality).toBe("balanced");
    store.getState().setQuality("high");
    expect(createRenderSettingsStore(storage).getState().quality).toBe("high");
    expect([...entries.keys()]).toEqual([RENDER_SETTINGS_KEY]);
    expect(JSON.parse(entries.get(RENDER_SETTINGS_KEY)!)).toEqual({ version: 1, quality: "high" });
    store.getState().setQuality("balanced");
    expect(createRenderSettingsStore(storage).getState().quality).toBe("balanced");
  });

  it("remains reversible with corrupt, future or blocked browser storage", () => {
    for (const saved of ["not json", '{"version":2,"quality":"high"}', "null"]) {
      const store = createRenderSettingsStore({
        getItem: () => saved,
        setItem: () => {
          throw Error("quota");
        },
      });
      expect(store.getState().quality).toBe("balanced");
      store.getState().setQuality("high");
      expect(store.getState().quality).toBe("high");
      expect(store.getState().preferenceSaved).toBe(false);
      store.getState().setQuality("balanced");
      expect(store.getState().quality).toBe("balanced");
    }
  });
});
