import { useMemo } from "react";
import * as THREE from "three";
import { mmToMetres } from "../domain/geometry";
import { resolveLaboratoryFloorFinish } from "../domain/laboratory-materials";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import type { Room } from "../domain/schema";
import { getLaboratoryMaterialTexture } from "../lib/laboratory-material-textures";

type RoomFloor3DProps = {
  room: Room;
  onClearSelection: () => void;
};

const floorMicrotextures = new Map<string, THREE.DataTexture>();

function getFloorMicrotexture(finishId: string) {
  const cached = floorMicrotextures.get(finishId);
  if (cached) return cached;
  const size = 128;
  const data = new Uint8Array(size * size);
  let seed = Array.from(finishId).reduce((value, character) => value + character.charCodeAt(0), 7919);
  for (let index = 0; index < data.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const fine = (seed >>> 24) / 255;
    const x = index % size;
    const y = Math.floor(index / size);
    const broad = (Math.sin(x * 0.18) + Math.cos(y * 0.16)) * 4;
    data[index] = Math.max(96, Math.min(210, Math.round(150 + (fine - 0.5) * 42 + broad)));
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  texture.name = `${finishId} floor microtexture`;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  floorMicrotextures.set(finishId, texture);
  return texture;
}

/**
 * Triangulated floor for one validated closed wall loop. Blank, open,
 * branched, or invalid wall sets intentionally render no slab.
 */
export function RoomFloor3D({ room, onClearSelection }: RoomFloor3DProps) {
  const floor = getClosedWallFloorPolygon(room.scene.objects);
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
  const finish = resolveLaboratoryFloorFinish(room.floorFinish);
  const floorTexture = finish.textureKind
    ? getLaboratoryMaterialTexture(finish.textureKind, { repeat: finish.textureRepeat })
    : undefined;
  const floorMicrotexture = getFloorMicrotexture(finish.id);

  if (!floor || !shape) return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={onClearSelection}
      userData={{ floorSource: "closed-walls", floorFinishId: finish.id }}
    >
      <shapeGeometry args={[shape]} />
      <meshPhysicalMaterial
        color={finish.color}
        map={floorTexture}
        roughnessMap={floorMicrotexture}
        bumpMap={floorTexture ?? floorMicrotexture}
        bumpScale={finish.bumpScale || 0.00042}
        metalness={finish.metalness}
        roughness={finish.roughness}
        clearcoat={finish.clearcoat}
        clearcoatRoughness={finish.clearcoatRoughness}
        envMapIntensity={1.08}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
