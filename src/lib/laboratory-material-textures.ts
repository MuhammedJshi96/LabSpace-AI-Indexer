import * as THREE from "three";

export type LaboratoryTexturedMaterialKind =
  | "epoxy"
  | "vinyl"
  | "phenolic"
  | "stainless"
  | "powder";

type MaterialTextureDefinition = {
  url: string;
  repeat: readonly [number, number];
  provenance: string;
};

export type LaboratoryMaterialTextureOptions = {
  /** UV repetitions across each generated mesh face. */
  repeat?: readonly [number, number];
  /** Requested sampling quality. Three.js also clamps this to the GPU limit. */
  anisotropy?: number;
  /** Optional renderer capability limit when it is already available to the caller. */
  maxAnisotropy?: number;
};

export const LABORATORY_MATERIAL_TEXTURES = {
  epoxy: {
    url: "/materials/epoxy-floor-room809.jpg",
    repeat: [4, 4],
    provenance: "Kyushu University Room 809 reference photograph",
  },
  vinyl: {
    url: "/materials/epoxy-floor-room809.jpg",
    repeat: [3, 3],
    provenance:
      "Kyushu University Room 809 floor reference, color-tinted for welded laboratory vinyl",
  },
  phenolic: {
    url: "/materials/phenolic-black-room809.jpg",
    repeat: [1, 1],
    provenance: "Kyushu University Room 809 reference photograph",
  },
  stainless: {
    url: "/materials/brushed-stainless-room809.jpg",
    repeat: [1, 1],
    provenance: "Kyushu University Room 809 reference photograph",
  },
  powder: {
    url: "/materials/powder-coat-gray-room809.jpg",
    repeat: [1, 1],
    provenance: "Kyushu University Room 809 reference photograph",
  },
} as const satisfies Record<LaboratoryTexturedMaterialKind, MaterialTextureDefinition>;

const DEFAULT_ANISOTROPY = 8;
const textureCache = new Map<string, THREE.Texture>();
const textureLoadPromises = new Map<string, Promise<void>>();
let textureLoader: THREE.TextureLoader | undefined;
let preloadPromise: Promise<void> | undefined;

function definitionFor(materialKind: string) {
  return Object.prototype.hasOwnProperty.call(LABORATORY_MATERIAL_TEXTURES, materialKind)
    ? LABORATORY_MATERIAL_TEXTURES[materialKind as LaboratoryTexturedMaterialKind]
    : undefined;
}

function positiveFinite(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolvedOptions(
  definition: MaterialTextureDefinition,
  options: LaboratoryMaterialTextureOptions,
) {
  const repeatX = positiveFinite(options.repeat?.[0], definition.repeat[0]);
  const repeatY = positiveFinite(options.repeat?.[1], definition.repeat[1]);
  const requestedAnisotropy = Math.max(
    1,
    Math.round(positiveFinite(options.anisotropy, DEFAULT_ANISOTROPY)),
  );
  const maximumAnisotropy = Math.max(
    1,
    Math.round(positiveFinite(options.maxAnisotropy, requestedAnisotropy)),
  );

  return {
    repeat: [repeatX, repeatY] as const,
    anisotropy: Math.min(requestedAnisotropy, maximumAnisotropy),
  };
}

/**
 * Applies the shared color-map settings for reusable laboratory materials.
 * The current photographs retain source provenance in the public registry.
 */
export function configureLaboratoryMaterialTexture(
  texture: THREE.Texture,
  materialKind: LaboratoryTexturedMaterialKind,
  options: LaboratoryMaterialTextureOptions = {},
) {
  const definition = LABORATORY_MATERIAL_TEXTURES[materialKind];
  const resolved = resolvedOptions(definition, options);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.UVMapping;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...resolved.repeat);
  texture.anisotropy = resolved.anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Returns a cached, browser-loaded color texture for a supported material kind.
 * Unsupported materials and non-browser rendering safely fall back to no map.
 */
export function getLaboratoryMaterialTexture(
  materialKind: string,
  options: LaboratoryMaterialTextureOptions = {},
): THREE.Texture | undefined {
  const definition = definitionFor(materialKind);
  if (!definition || typeof document === "undefined") return undefined;
  const texturedMaterialKind = materialKind as LaboratoryTexturedMaterialKind;

  const resolved = resolvedOptions(definition, options);
  const cacheKey = [materialKind, resolved.repeat[0], resolved.repeat[1], resolved.anisotropy].join(
    "|",
  );
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  textureLoader ??= new THREE.TextureLoader();

  try {
    let settleLoad: (() => void) | undefined;
    const loadPromise = new Promise<void>((resolve) => {
      settleLoad = resolve;
    });
    const loadedTexture = textureLoader.load(
      definition.url,
      (texture) => {
        configureLaboratoryMaterialTexture(texture, texturedMaterialKind, resolved);
        settleLoad?.();
      },
      undefined,
      () => {
        // Permit a later retry after an interrupted development-server request.
        textureCache.delete(cacheKey);
        textureLoadPromises.delete(cacheKey);
        settleLoad?.();
      },
    );
    const texture = configureLaboratoryMaterialTexture(
      loadedTexture,
      texturedMaterialKind,
      resolved,
    );
    textureCache.set(cacheKey, texture);
    textureLoadPromises.set(cacheKey, loadPromise);
    return texture;
  } catch {
    // A missing DOM image implementation or loader failure must not blank 3D.
    return undefined;
  }
}

/** Ensures same-model plan/library captures include the photographic maps. */
export function waitForLaboratoryMaterialTextures() {
  if (typeof document === "undefined") return Promise.resolve();
  preloadPromise ??= Promise.all(
    (Object.keys(LABORATORY_MATERIAL_TEXTURES) as LaboratoryTexturedMaterialKind[]).map((kind) => {
      const repeat: readonly [number, number] =
        kind === "epoxy"
          ? [4, 4]
          : kind === "vinyl"
            ? [3, 3]
          : kind === "powder"
            ? [3, 3]
            : kind === "stainless"
              ? [2, 2]
              : [1.5, 1.5];
      const options: LaboratoryMaterialTextureOptions = { repeat };
      const texture = getLaboratoryMaterialTexture(kind, options);
      if (!texture) return Promise.resolve();
      const resolved = resolvedOptions(LABORATORY_MATERIAL_TEXTURES[kind], options);
      const cacheKey = [kind, resolved.repeat[0], resolved.repeat[1], resolved.anisotropy].join(
        "|",
      );
      return textureLoadPromises.get(cacheKey) ?? Promise.resolve();
    }),
  ).then(() => undefined);
  return preloadPromise;
}

export function clearLaboratoryMaterialTextureCache() {
  textureCache.forEach((texture) => texture.dispose());
  textureCache.clear();
  textureLoadPromises.clear();
  preloadPromise = undefined;
}
