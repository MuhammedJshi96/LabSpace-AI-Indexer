import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mmToMetres } from "../domain/geometry";
import { resolveLaboratoryFloorFinish } from "../domain/laboratory-materials";
import { getRoomSpaceFloorPlans } from "../domain/room-geometry";
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
  const floors = useMemo(() => getRoomSpaceFloorPlans(room), [room]);
  const geometries = useMemo(() => {
    const toShapePoint = (point: { x: number; y: number }) => ({
      x: mmToMetres(point.x - room.width / 2),
      // ShapeGeometry is rotated onto XZ; invert plan Y so it matches the
      // existing positive-Z room coordinate convention.
      y: mmToMetres(room.depth / 2 - point.y),
    });
    return floors.map((floor) => {
      const shape = new THREE.Shape();
      const first = toShapePoint(floor.points[0]);
      shape.moveTo(first.x, first.y);
      floor.points.slice(1).forEach((point) => {
        const converted = toShapePoint(point);
        shape.lineTo(converted.x, converted.y);
      });
      shape.closePath();
      return { floor, geometry: new THREE.ShapeGeometry(shape) };
    });
  }, [floors, room.depth, room.width]);
  useEffect(() => () => geometries.forEach(({ geometry }) => geometry.dispose()), [geometries]);

  if (!geometries.length) return null;

  return (
    <group>
      {geometries.map(({ floor, geometry }) => {
        const finish = resolveLaboratoryFloorFinish(floor.floorFinish);
        return (
          <mesh
            key={floor.spaceId}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={onClearSelection}
            userData={{
              floorSource: "closed-walls",
              floorFinishId: finish.id,
              spaceId: floor.spaceId,
            }}
            material={getRoomFloorMaterial(finish)}
            dispose={null}
            geometry={geometry}
          />
        );
      })}
    </group>
  );
}
