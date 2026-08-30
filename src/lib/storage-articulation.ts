import * as THREE from "three";
import type { StorageMechanism } from "../domain/storage-access";

export function cloneStorageScene(source: THREE.Object3D) {
  // Geometry/materials stay shared. Transforms are private to this instance,
  // so opening one cabinet cannot open every copy or poison the GLTF cache.
  const scene = source.clone(true);
  const parts: Array<{
    node: THREE.Object3D;
    mechanism: StorageMechanism;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    progress: number;
  }> = [];
  scene.traverse((node) => {
    const mechanism = node.userData.storageMechanism as StorageMechanism | undefined;
    if (mechanism && ["hinge", "drawer"].includes(mechanism.kind)) {
      parts.push({
        node,
        mechanism,
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
        progress: 0,
      });
    }
  });
  return { scene, parts };
}

const hingeAxis = new THREE.Vector3(0, 1, 0);
const turn = new THREE.Quaternion();
export function applyStoragePose(
  part: ReturnType<typeof cloneStorageScene>["parts"][number],
  progress: number,
) {
  const amount = THREE.MathUtils.clamp(progress, 0, 1);
  part.node.position.copy(part.position);
  part.node.quaternion.copy(part.quaternion);
  if (part.mechanism.kind === "hinge") {
    part.node.quaternion.multiply(turn.setFromAxisAngle(hingeAxis, part.mechanism.angle * amount));
  } else {
    part.node.position.z += part.mechanism.travel * amount;
  }
}
