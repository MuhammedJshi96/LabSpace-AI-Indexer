import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mmToMetres } from "../domain/geometry";
import { resolveLaboratoryFloorFinish } from "../domain/laboratory-materials";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import type { Room } from "../domain/schema";
import { getRoomFloorMaterial } from "../lib/room-surface-materials";

type RoomFloor3DProps = {
  room: Room;
  onClearSelection: () => void;
};

/**
 * Triangulated floor for one validated closed wall loop. Blank, open,
 * branched, or invalid wall sets intentionally render no slab.
 */
export function RoomFloor3D({ room, onClearSelection }: RoomFloor3DProps) {
  const floor = useMemo(() => getClosedWallFloorPolygon(room.scene.objects), [room.scene.objects]);
  const shape = useMemo(() => {
    if (!floor) return null;
    const nextShape = new THREE.Shape();
    const toShapePoint = (point: { x: number; y: number }) => ({
      x: mmToMetres(point.x - room.width / 2),
      // ShapeGeometry is rotated onto XZ; invert plan Y so it matches the
      // existing positive-Z room coordinate convention.
      y: mmToMetres(room.depth / 2 - point.y),
    });
    const first = toShapePoint(floor.points[0]);
    nextShape.moveTo(first.x, first.y);
    floor.points.slice(1).forEach((point) => {
      const converted = toShapePoint(point);
      nextShape.lineTo(converted.x, converted.y);
    });
    nextShape.closePath();
    return nextShape;
  }, [floor, room.depth, room.width]);
  const geometry = useMemo(() => (shape ? new THREE.ShapeGeometry(shape) : null), [shape]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const finish = resolveLaboratoryFloorFinish(room.floorFinish);

  if (!floor || !geometry) return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={onClearSelection}
      userData={{ floorSource: "closed-walls", floorFinishId: finish.id }}
      material={getRoomFloorMaterial(finish)}
      dispose={null}
      geometry={geometry}
    />
  );
}
