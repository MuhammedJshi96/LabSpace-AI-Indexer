import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { AssetDefinition } from "../domain/schema";
import { getLaboratoryMaterialTexture } from "../lib/laboratory-material-textures";
import { ProceduralAssetModel } from "./ProceduralAssetModel";
import { applyStoragePose, cloneStorageScene } from "../lib/storage-articulation";
import { applyReviewedAuthoredFinish } from "../lib/authored-finish";
import { bindPresentationMaterials, type PresentationBinding } from "../lib/presentation-materials";
import { attachExclusiveScene } from "../lib/scene-instance-lifecycle";
import { useRenderSettings } from "../store/render-settings-store";

type DetailLevel = "room" | "preview";

type AssetVisualProps = {
  definition: AssetDefinition;
  width: number;
  depth: number;
  height: number;
  detail?: DetailLevel;
  onReady?: () => void;
  openStorageParts?: readonly string[];
};

const enhancedMaterials = new WeakSet<THREE.Material>();

function enhanceAuthoredMaterial(material: THREE.Material) {
  if (enhancedMaterials.has(material) || !(material instanceof THREE.MeshStandardMaterial)) return;
  if (applyReviewedAuthoredFinish(material)) {
    enhancedMaterials.add(material);
    return;
  }
  const name = material.name.toLowerCase();
  const isPrimaryDarkWorktop =
    name.includes("phenolic worktop") || name.includes("phenolic exposed edge");
  const isPrimaryGraphitePanel = name.includes("graphite powder coat");
  const isPrimaryDarkPolymer = name.includes("black engineering polymer");
  const isStudioReadableSatin = name.includes("studio-readable satin stainless steel");
  const isLightCaseworkPowder =
    name.includes("light gray powder coat") || name.includes("powder coat highlight");
  const isSatinMetal =
    name.includes("stainless") ||
    name.includes("anodized aluminum") ||
    name.includes("satin aluminum") ||
    name.includes("brushed aluminum");
  const isLaboratoryGlass =
    name.includes("borosilicate") ||
    name.includes("ground glass") ||
    name.includes("bath water") ||
    name.includes("blue solvent") ||
    name.includes("coolant hose") ||
    name.includes("silicone hose");
  const materialKind = isPrimaryDarkWorktop
    ? "phenolic"
    : name.includes("stainless")
      ? "stainless"
      : name.includes("powder")
        ? "powder"
        : null;
  if (materialKind) {
    const repeat: readonly [number, number] =
      materialKind === "powder" ? [3, 3] : materialKind === "stainless" ? [2, 2] : [1.5, 1.5];
    const texture = getLaboratoryMaterialTexture(materialKind, { repeat });
    if (texture) {
      material.map = texture;
      material.bumpMap = texture;
      material.bumpScale = materialKind === "powder" ? 0.00018 : 0.00008;
      if (isPrimaryDarkWorktop) {
        // A phenolic material exists only on an authored work surface that is
        // intentionally black. Preserve that finish for benches, sink bases,
        // island modules and casework instead of recoloring cabinet assets to
        // stainless when their manifest id does not contain "bench".
        material.color.set("#ffffff");
        material.metalness = 0.03;
        material.roughness = 0.27;
      }
      material.needsUpdate = true;
    }
  }
  if (isPrimaryGraphitePanel) {
    material.color.set("#7f8b88");
    material.metalness = 0.24;
    material.roughness = 0.32;
    material.needsUpdate = true;
  }
  if (isLightCaseworkPowder) {
    material.color.set(name.includes("highlight") ? "#f1f4f2" : "#dce3e0");
    material.metalness = 0.08;
    material.roughness = 0.3;
    material.needsUpdate = true;
  }
  if (isPrimaryDarkPolymer) {
    material.color.set("#697673");
    material.metalness = 0.18;
    material.roughness = 0.4;
    material.needsUpdate = true;
  }
  // Authored hero assets already carry physically meaningful material names.
  // Strengthen their studio response at runtime so the same GLB reads as metal,
  // glass and liquid in the room rather than as uniformly shaded CAD plastic.
  material.envMapIntensity = isSatinMetal ? 1.55 : 1.18;
  if (isStudioReadableSatin) {
    // Open-frame furniture and emergency fixtures need to stay legible against
    // both the pale CAD studio and the darker laboratory room. Preserve a
    // satin-metal response without turning thin structural members black.
    material.color.set("#d8e0de");
    material.metalness = 0.14;
    material.roughness = 0.36;
  } else if (isSatinMetal) {
    material.metalness = Math.max(material.metalness, 0.82);
    material.roughness = Math.min(material.roughness, 0.25);
  }
  if (isLaboratoryGlass && material instanceof THREE.MeshPhysicalMaterial) {
    material.transparent = true;
    material.depthWrite = false;
    material.transmission = Math.max(material.transmission, 0.72);
    material.thickness = Math.max(material.thickness, 0.008);
    material.ior = name.includes("water") ? 1.333 : 1.47;
    material.roughness = name.includes("ground glass")
      ? Math.min(material.roughness, 0.2)
      : Math.min(material.roughness, 0.075);
    material.attenuationDistance = 1.8;
    material.attenuationColor.set(name.includes("solvent") ? "#8cc7ff" : "#e8fbff");
  }
  material.needsUpdate = true;
  enhancedMaterials.add(material);
}

function ReadySignal({ onReady }: { onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady]);
  return null;
}

function ManagedSceneInstance({ scene }: { scene: THREE.Object3D }) {
  const host = useRef<THREE.Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const current = host.current;
    if (!current) return;
    const release = attachExclusiveScene(current, scene);
    invalidate();
    return release;
  }, [invalidate, scene]);

  return <group ref={host} />;
}

function ProceduralFallback(props: AssetVisualProps & { signalReady?: boolean }) {
  return (
    <>
      <ProceduralAssetModel {...props} />
      {props.signalReady && <ReadySignal onReady={props.onReady} />}
    </>
  );
}

class AssetModelBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; source: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: Readonly<{ source: string }>) {
    if (previous.source !== this.props.source && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  componentDidCatch(error: Error) {
    console.warn(`Authored asset model failed to load: ${this.props.source}`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function AuthoredAssetModel({
  definition,
  width,
  depth,
  height,
  detail = "room",
  onReady,
  openStorageParts = [],
}: AssetVisualProps) {
  const model = definition.model3d!;
  const source = `${detail === "room" && model.roomSrc ? model.roomSrc : model.previewSrc}?v=${encodeURIComponent(model.revision)}`;
  // The decoder is served with the application so authored assets remain fully
  // offline while dense rooms benefit from compressed geometry delivery.
  const { scene } = useGLTF(source, "/draco/gltf/", true);
  const invalidate = useThree((state) => state.invalidate);
  const quality = useRenderSettings((state) => state.quality);
  const authored = model.authoredDimensions;

  const enhancedScene = useMemo(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => enhanceAuthoredMaterial(material));
    });
    return cloneStorageScene(scene);
  }, [scene]);

  const materialBindings = useMemo(() => {
    const bindings: PresentationBinding[] = [];
    enhancedScene.scene.traverse((node) => {
      if (node instanceof THREE.Mesh)
        bindings.push({
          mesh: node,
          materials: Array.isArray(node.material) ? node.material : [node.material],
          multiple: Array.isArray(node.material),
        });
    });
    return bindings;
  }, [enhancedScene]);
  useLayoutEffect(() => {
    const release = bindPresentationMaterials(materialBindings, quality);
    invalidate(2);
    return release;
  }, [materialBindings, quality, invalidate]);

  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const openParts = useMemo(() => new Set(openStorageParts), [openStorageParts]);
  const animationProgress = useRef(new Map<string, number>());
  useEffect(() => invalidate(), [invalidate, openParts]);
  useFrame((_, delta) => {
    for (const part of enhancedScene.parts) {
      const target = openParts.has(part.mechanism.id) ? 1 : 0;
      const progress = animationProgress.current.get(part.mechanism.id) ?? 0;
      if (Math.abs(progress - target) < 0.001) {
        if (progress !== target) {
          animationProgress.current.set(part.mechanism.id, target);
          applyStoragePose(part, target);
        }
        continue;
      }
      const next = reducedMotion
        ? target
        : THREE.MathUtils.damp(progress, target, 12, Math.min(delta, 0.05));
      animationProgress.current.set(part.mechanism.id, next);
      applyStoragePose(part, next);
      invalidate();
    }
  });

  useEffect(() => {
    invalidate();
    onReady?.();
  }, [invalidate, onReady, scene]);

  return (
    <group
      dispose={null}
      scale={[
        width / (authored.width / 1000),
        height / (authored.height / 1000),
        depth / (authored.depth / 1000),
      ]}
    >
      <ManagedSceneInstance scene={enhancedScene.scene} />
    </group>
  );
}

/**
 * Shared visual entry point for the room, plan renders, library cards and Asset Studio.
 * Authored PBR GLBs are preferred when available; each asset remains protected by a
 * procedural fallback so a missing or damaged file cannot blank an editor view.
 * The fallback is intentionally error-only: showing it while an authored GLB
 * loads can make legacy and current constructions appear stacked together.
 */
export function AssetVisual(props: AssetVisualProps) {
  const model = props.definition.model3d;
  if (!model) return <ProceduralFallback {...props} signalReady />;

  const source = `${props.detail === "room" && model.roomSrc ? model.roomSrc : model.previewSrc}?v=${encodeURIComponent(model.revision)}`;
  const failedFallback = <ProceduralFallback {...props} signalReady />;

  return (
    <AssetModelBoundary key={source} source={source} fallback={failedFallback}>
      <Suspense fallback={null}>
        <AuthoredAssetModel key={source} {...props} />
      </Suspense>
    </AssetModelBoundary>
  );
}
