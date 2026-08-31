import { useEffect, useMemo } from "react";
import type { LaboratoryWallFinish } from "../domain/laboratory-wall-materials";
import { getRoomWallMaterial, roomSurfaceBoxGeometry } from "../lib/room-surface-materials";

type Tuple = [number, number, number];

/** Unsubdivided wall box with metre-scale detail shared with every room. */
export function RoomWallBlock({
  position,
  size,
  finish,
  opacity = 1,
}: {
  position: Tuple;
  size: Tuple;
  finish: LaboratoryWallFinish;
  opacity?: number;
}) {
  const [x, y, z] = position;
  const [width, height, depth] = size;
  const geometry = useMemo(
    () => roomSurfaceBoxGeometry([width, height, depth], [x, y, z]),
    [width, height, depth, x, y, z],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      position={position}
      geometry={geometry}
      material={getRoomWallMaterial(finish, opacity)}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
