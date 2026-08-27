import {
  Suspense,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  useProgress,
} from "@react-three/drei";
import {
  Cube,
  Eye,
  PlugsConnected,
  SelectionAll,
  SquareSplitHorizontal,
} from "@phosphor-icons/react";
import * as THREE from "three";
import { getAssetDefinition } from "../domain/assets";
import {
  cameraCommandKey,
  digitalTwinCameraApproach,
  editorInitialIsometricPosition,
} from "../domain/camera-command";
import { shouldCutawayWall } from "../domain/digital-twin-cutaway";
import { mmToMetres, wallAngle, wallLength } from "../domain/geometry";
import { hasLaboratoryEnvironmentProfile } from "../domain/laboratory-environment";
import { wallFinishForObject } from "../domain/laboratory-wall-materials";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import { waitForLaboratoryMaterialTextures } from "../lib/laboratory-material-textures";
import type { Room, SceneObject, StorageLocationType } from "../domain/schema";
import {
  storageAccessContentStyle,
  storageLocationHighlight,
  storageLocationSupportsAccessPreview,
  type StorageAccessContentStyle,
} from "../domain/storage-highlight";
import { resolveHostedOpening } from "../domain/wall-openings";
import { selectActiveRoom, useEditorStore, type CameraPreset } from "../store/editor-store";
import {
  ModelBox as Box,
  ModelCylinder as Cylinder,
  ProceduralAssetModel,
  SelectionBounds,
} from "./ProceduralAssetModel";
import { AssetVisual } from "./AssetVisual";
import { LaboratoryEnvironment } from "./LaboratoryEnvironment";
import { RoomFloor3D } from "./RoomFloor3D";

// Keep the camera constructor props referentially stable. Recreating this
// tuple during every room-object update makes React Three Fiber re-apply the
// initial position and destroys a user's manual orbit while they edit in 2D.
const DEFAULT_CAMERA_POSITION: [number, number, number] = [8, 8, 8];

function Wall3D({
  wall,
  room,
  transparentOverride,
  presentation,
}: {
  wall: SceneObject;
  room: Room;
  transparentOverride?: boolean;
  presentation: "editor" | "digital-twin";
}) {
  const editorWallTransparent = useEditorStore((state) => state.wallTransparent);
  const wallTransparent = transparentOverride ?? editorWallTransparent;
  const wallGroupRef = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    if (!wallGroupRef.current) return;
    wallGroupRef.current.visible =
      !wallTransparent ||
      presentation !== "digital-twin" ||
      !shouldCutawayWall(wall, room, camera.position);
  });
  if (!wall.wall) return null;
  const length = mmToMetres(wallLength(wall));
  const height = mmToMetres(wall.wall.height);
  const thickness = mmToMetres(wall.wall.thickness);
  const angle = THREE.MathUtils.degToRad(wallAngle(wall));
  const related = room.scene.objects
    .filter((object) => object.opening?.wallId === wall.id)
    .map((object) => {
      const width = object.opening?.width ?? object.dimensions.width;
      return {
        object,
        start: mmToMetres(Math.max(0, (object.opening?.offset ?? 0) - width / 2)),
        end: mmToMetres(Math.min(wallLength(wall), (object.opening?.offset ?? 0) + width / 2)),
      };
    })
    .sort((a, b) => a.start - b.start);
  const spans: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const opening of related) {
    if (opening.start > cursor) spans.push({ start: cursor, end: opening.start });
    cursor = Math.max(cursor, opening.end);
  }
  if (cursor < length) spans.push({ start: cursor, end: length });
  const startX = mmToMetres(wall.wall.start.x - room.width / 2);
  const startZ = mmToMetres(wall.wall.start.y - room.depth / 2);
  const opacity = wallTransparent && presentation === "editor" ? 0.28 : 1;
  const finish = wallFinishForObject(wall.metadata, room.wallFinish);
  const materialKind =
    finish.id === "satin-stainless-steel"
      ? "stainless"
      : finish.id.includes("panel")
        ? "powder"
        : "painted";

  return (
    <group ref={wallGroupRef} position={[startX, 0, startZ]} rotation={[0, -angle, 0]}>
      {spans.map((span, index) => {
        const renderStart = span.start;
        const renderEnd = span.end;
        const renderLength = Math.max(0.01, renderEnd - renderStart);
        return (
          <group key={`span-${index}`}>
            <Box
              position={[(renderStart + renderEnd) / 2, height / 2, 0]}
              scale={[renderLength, height, thickness]}
              color={finish.color}
              opacity={opacity}
              metalness={finish.metalness}
              roughness={finish.roughness}
              materialKind={materialKind}
              clearcoat={finish.clearcoat}
              clearcoatRoughness={finish.clearcoatRoughness}
              envMapIntensity={presentation === "digital-twin" ? 1.02 : 0.82}
              sharp
            />
            <Box
              position={[(renderStart + renderEnd) / 2, 0.047, -thickness * 0.53]}
              scale={[renderLength, 0.094, 0.018]}
              color={finish.baseboardColor}
              opacity={opacity}
              metalness={0.28}
              roughness={0.42}
              materialKind="aluminum"
              clearcoat={0.14}
              clearcoatRoughness={0.28}
              envMapIntensity={1.1}
              sharp
            />
          </group>
        );
      })}
      {related.map(({ object, start, end }) => {
        const opening = object.opening!;
        const openingHeight = mmToMetres(opening.height);
        const sill = mmToMetres(opening.sillHeight);
        const openingWidth = Math.max(0.01, end - start);
        return (
          <group key={object.id}>
            {sill > 0 && (
              <Box
                position={[(start + end) / 2, sill / 2, 0]}
                scale={[openingWidth, sill, thickness]}
                color={finish.color}
                opacity={opacity}
                metalness={finish.metalness}
                roughness={finish.roughness}
                materialKind={materialKind}
                clearcoat={finish.clearcoat}
                clearcoatRoughness={finish.clearcoatRoughness}
                envMapIntensity={presentation === "digital-twin" ? 1.02 : 0.82}
                sharp
              />
            )}
            {height > sill + openingHeight && (
              <Box
                position={[
                  (start + end) / 2,
                  sill + openingHeight + (height - sill - openingHeight) / 2,
                  0,
                ]}
                scale={[openingWidth, height - sill - openingHeight, thickness]}
                color={finish.color}
                opacity={opacity}
                metalness={finish.metalness}
                roughness={finish.roughness}
                materialKind={materialKind}
                clearcoat={finish.clearcoat}
                clearcoatRoughness={finish.clearcoatRoughness}
                envMapIntensity={presentation === "digital-twin" ? 1.02 : 0.82}
                sharp
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

function WallJoints3D({
  walls,
  room,
  presentation,
  transparentOverride,
}: {
  walls: SceneObject[];
  room: Room;
  presentation: "editor" | "digital-twin";
  transparentOverride?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  const editorWallTransparent = useEditorStore((state) => state.wallTransparent);
  const wallTransparent = transparentOverride ?? editorWallTransparent;
  const joints = useMemo(() => {
    const clusters: Array<{
      point: { x: number; y: number };
      walls: SceneObject[];
    }> = [];
    for (const wall of walls) {
      if (!wall.wall) continue;
      for (const point of [wall.wall.start, wall.wall.end]) {
        let cluster = clusters.find(
          (candidate) => Math.hypot(candidate.point.x - point.x, candidate.point.y - point.y) <= 80,
        );
        if (!cluster) {
          cluster = { point: { ...point }, walls: [] };
          clusters.push(cluster);
        }
        if (!cluster.walls.some((candidate) => candidate.id === wall.id)) cluster.walls.push(wall);
      }
    }
    return clusters.filter((cluster) => cluster.walls.length > 1);
  }, [walls]);
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, index) => {
      const joint = joints[index];
      child.visible =
        !wallTransparent ||
        presentation !== "digital-twin" ||
        joint.walls.some((wall) => !shouldCutawayWall(wall, room, camera.position));
    });
  });
  const finish = wallFinishForObject({}, room.wallFinish);
  const materialKind =
    finish.id === "satin-stainless-steel"
      ? "stainless"
      : finish.id.includes("panel")
        ? "powder"
        : "painted";

  return (
    <group ref={groupRef}>
      {joints.map((joint, index) => {
        const thickness = Math.max(...joint.walls.map((wall) => wall.wall!.thickness));
        const height = Math.max(...joint.walls.map((wall) => wall.wall!.height));
        return (
          <Box
            key={`${Math.round(joint.point.x)}-${Math.round(joint.point.y)}-${index}`}
            position={[
              mmToMetres(joint.point.x - room.width / 2),
              mmToMetres(height) / 2,
              mmToMetres(joint.point.y - room.depth / 2),
            ]}
            scale={[mmToMetres(thickness) * 1.01, mmToMetres(height), mmToMetres(thickness) * 1.01]}
            color={finish.color}
            opacity={wallTransparent && presentation === "editor" ? 0.28 : 1}
            metalness={finish.metalness}
            roughness={finish.roughness}
            materialKind={materialKind}
            clearcoat={finish.clearcoat}
            clearcoatRoughness={finish.clearcoatRoughness}
            envMapIntensity={presentation === "digital-twin" ? 1.02 : 0.82}
            sharp
          />
        );
      })}
    </group>
  );
}

function Opening3D({
  object,
  room,
  selected,
  transparentOverride,
  presentation,
}: {
  object: SceneObject;
  room: Room;
  selected: boolean;
  transparentOverride?: boolean;
  presentation: "editor" | "digital-twin";
}) {
  const resolved = resolveHostedOpening(object, room.scene.objects);
  const openingGroupRef = useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    if (!openingGroupRef.current) return;
    openingGroupRef.current.visible =
      !transparentOverride ||
      presentation !== "digital-twin" ||
      !shouldCutawayWall(resolved?.wall, room, camera.position);
  });
  const definition = getAssetDefinition(object.assetDefinitionId);
  const setSelected = useEditorStore((state) => state.setSelected);
  const width = mmToMetres(object.opening?.width ?? object.dimensions.width);
  const height = mmToMetres(object.opening?.height ?? object.dimensions.height);
  const depth = Math.max(
    0.08,
    mmToMetres(resolved?.wall.wall?.thickness ?? object.dimensions.depth),
  );
  const x = mmToMetres((resolved?.point.x ?? object.position.x) - room.width / 2);
  const z = mmToMetres((resolved?.point.y ?? object.position.y) - room.depth / 2);
  const rotation = THREE.MathUtils.degToRad(resolved?.rotation ?? object.rotation.z);
  const window = object.objectType === "window";
  const sill = mmToMetres(object.opening?.sillHeight ?? (window ? 900 : 0));
  const flipHorizontal = window ? object.flipHorizontal : object.opening?.handing === "right";
  const flipVertical = window ? object.flipVertical : object.opening?.swing === "outward";
  return (
    <group
      ref={openingGroupRef}
      position={[x, sill, z]}
      rotation={[0, -rotation, 0]}
      scale={[flipHorizontal ? -1 : 1, 1, flipVertical ? -1 : 1]}
      onClick={(event) => {
        event.stopPropagation();
        setSelected([object.id], event.shiftKey);
      }}
    >
      {definition.model3d ? (
        <AssetVisual
          definition={definition}
          width={width}
          depth={depth}
          height={height}
          detail="room"
        />
      ) : (
        <ProceduralAssetModel
          definition={definition}
          width={width}
          depth={depth}
          height={height}
          detail="room"
        />
      )}
      {selected && <SelectionBounds width={width} depth={depth} height={height} />}
    </group>
  );
}

function StoragePreviewContents({
  style,
  width,
  height,
  depth,
}: {
  style: StorageAccessContentStyle;
  width: number;
  height: number;
  depth: number;
}) {
  const usableWidth = width * 0.82;
  const usableDepth = depth * 0.68;
  const itemHeight = Math.min(0.12, Math.max(0.04, height * 0.34));

  if (style === "vials") {
    return (
      <group>
        <Box
          position={[0, 0.018, 0]}
          scale={[usableWidth, 0.025, usableDepth]}
          color="#dbe3e0"
          materialKind="powder"
          roughness={0.4}
          edgeRadius={0.004}
        />
        {Array.from({ length: 12 }, (_, index) => {
          const column = index % 4;
          const row = Math.floor(index / 4);
          const x = -usableWidth * 0.36 + column * usableWidth * 0.24;
          const z = -usableDepth * 0.28 + row * usableDepth * 0.28;
          const diameter = Math.min(0.045, usableWidth / 7.8);
          return (
            <group key={`vial-${index}`} position={[x, 0.04, z]}>
              <Cylinder
                position={[0, itemHeight * 0.42, 0]}
                scale={[diameter, itemHeight * 0.72, diameter]}
                color="#d5e7e6"
                materialKind="glass"
                opacity={0.55}
                roughness={0.08}
                castShadow={false}
              />
              <Cylinder
                position={[0, itemHeight * 0.84, 0]}
                scale={[diameter * 1.16, itemHeight * 0.14, diameter * 1.16]}
                color="#236fa7"
                roughness={0.36}
                castShadow={false}
              />
              <Cylinder
                position={[0, itemHeight * 0.48, 0]}
                scale={[diameter * 1.04, itemHeight * 0.16, diameter * 1.04]}
                color="#f4f5f1"
                roughness={0.62}
                castShadow={false}
              />
            </group>
          );
        })}
      </group>
    );
  }

  if (style === "glassware" || style === "bottles") {
    const count = style === "glassware" ? 4 : 5;
    return (
      <group>
        {Array.from({ length: count }, (_, index) => {
          const x = -usableWidth * 0.4 + (usableWidth * 0.8 * index) / Math.max(1, count - 1);
          const diameter = Math.min(0.085, usableWidth / (count * 1.45));
          const isGlass = style === "glassware" || index % 2 === 0;
          return (
            <group key={`${style}-${index}`} position={[x, 0.03, index % 2 ? 0.025 : -0.025]}>
              <Cylinder
                position={[0, itemHeight * 0.42, 0]}
                scale={[diameter, itemHeight * 0.72, diameter]}
                color={isGlass ? "#d6e7e5" : "#76502c"}
                materialKind="glass"
                opacity={isGlass ? 0.5 : 0.76}
                roughness={0.1}
                castShadow={false}
              />
              <Cylinder
                position={[0, itemHeight * 0.79, 0]}
                scale={[diameter * 0.48, itemHeight * 0.2, diameter * 0.48]}
                color={isGlass ? "#d6e7e5" : "#76502c"}
                materialKind="glass"
                opacity={isGlass ? 0.5 : 0.76}
                roughness={0.1}
                castShadow={false}
              />
              <Cylinder
                position={[0, itemHeight * 0.93, 0]}
                scale={[diameter * 0.58, itemHeight * 0.1, diameter * 0.58]}
                color={style === "bottles" ? (index % 3 === 0 ? "#2672a9" : "#e8edeb") : "#aebbb8"}
                roughness={0.4}
                castShadow={false}
              />
              {style === "bottles" && (
                <Cylinder
                  position={[0, itemHeight * 0.46, 0]}
                  scale={[diameter * 1.03, itemHeight * 0.2, diameter * 1.03]}
                  color="#f2f3ef"
                  roughness={0.62}
                  castShadow={false}
                />
              )}
            </group>
          );
        })}
      </group>
    );
  }

  return (
    <group>
      {Array.from({ length: 6 }, (_, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const boxWidth = usableWidth * 0.27;
        const boxDepth = usableDepth * 0.38;
        const x = -usableWidth * 0.31 + column * usableWidth * 0.31;
        const z = -usableDepth * 0.22 + row * usableDepth * 0.46;
        return (
          <group key={`box-${index}`} position={[x, 0.026, z]}>
            <Box
              position={[0, itemHeight * 0.28, 0]}
              scale={[boxWidth, itemHeight * 0.5, boxDepth]}
              color="#edf1ef"
              materialKind="powder"
              roughness={0.46}
              edgeRadius={0.004}
            />
            <Box
              position={[0, itemHeight * 0.56, 0]}
              scale={[boxWidth * 0.96, itemHeight * 0.08, boxDepth * 0.94]}
              color={index % 3 === 1 ? "#54a69a" : "#4f91ac"}
              roughness={0.38}
              edgeRadius={0.002}
              castShadow={false}
            />
            <Box
              position={[0, itemHeight * 0.3, boxDepth / 2 + 0.003]}
              scale={[boxWidth * 0.55, itemHeight * 0.12, 0.006]}
              color="#ffffff"
              roughness={0.68}
              sharp
              castShadow={false}
            />
          </group>
        );
      })}
    </group>
  );
}

function StorageAccessPreview({
  position,
  width,
  depth,
  height,
  locationType,
  contentStyle,
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  locationType: StorageLocationType;
  contentStyle: StorageAccessContentStyle;
}) {
  const openingWidth = Math.max(0.1, width * 0.94);
  const openingHeight = Math.max(0.08, height * 0.88);
  const frontZ = position[2] + depth / 2 + 0.014;
  const pullOut = Math.min(0.48, Math.max(0.24, depth * 0.72));
  const drawerLike = locationType === "drawer" || locationType === "bin";
  if (!storageLocationSupportsAccessPreview(locationType)) return null;

  return (
    <group name={`Selected ${locationType} access preview`} dispose={null}>
      <Box
        position={[position[0], position[1] + height / 2, frontZ]}
        scale={[openingWidth, openingHeight, 0.028]}
        color="#4e5956"
        metalness={0.16}
        roughness={0.58}
        sharp
      />
      {drawerLike ? (
        <group position={[position[0], position[1], frontZ + pullOut / 2 + 0.035]}>
          <Box
            position={[0, openingHeight * 0.16, 0]}
            scale={[openingWidth * 0.92, 0.035, pullOut]}
            color={locationType === "bin" ? "#8caeb8" : "#b9c4c1"}
            materialKind="stainless"
            metalness={locationType === "bin" ? 0.08 : 0.68}
            roughness={0.3}
            edgeRadius={0.005}
          />
          {[-1, 1].map((side) => (
            <Box
              key={side}
              position={[side * openingWidth * 0.44, openingHeight * 0.38, 0]}
              scale={[0.025, openingHeight * 0.48, pullOut]}
              color="#d7dfdc"
              metalness={0.14}
              roughness={0.34}
              edgeRadius={0.004}
            />
          ))}
          <Box
            position={[0, openingHeight * 0.38, -pullOut * 0.48]}
            scale={[openingWidth * 0.9, openingHeight * 0.48, 0.025]}
            color="#d7dfdc"
            metalness={0.14}
            roughness={0.34}
            edgeRadius={0.004}
          />
          <group position={[0, openingHeight * 0.21, pullOut * 0.02]}>
            <StoragePreviewContents
              style={contentStyle}
              width={openingWidth}
              height={openingHeight}
              depth={pullOut}
            />
          </group>
          <Box
            position={[0, openingHeight * 0.5, pullOut / 2 + 0.022]}
            scale={[openingWidth, openingHeight, 0.044]}
            color="#dce3e0"
            materialKind="powder"
            metalness={0.08}
            roughness={0.3}
            edgeRadius={0.006}
          />
          <Box
            position={[0, openingHeight * 0.5, pullOut / 2 + 0.052]}
            scale={[openingWidth * 0.42, Math.min(0.025, openingHeight * 0.13), 0.022]}
            color="#82908d"
            materialKind="aluminum"
            metalness={0.64}
            roughness={0.24}
            edgeRadius={0.003}
          />
          <SelectionBounds width={openingWidth} depth={pullOut + 0.08} height={openingHeight} />
        </group>
      ) : (
        <>
          <group
            position={[position[0] - openingWidth / 2, position[1], frontZ + 0.02]}
            rotation={[0, -Math.PI * 0.38, 0]}
          >
            <Box
              position={[openingWidth / 2, openingHeight / 2, 0]}
              scale={[openingWidth, openingHeight, 0.042]}
              color="#dce3e0"
              materialKind="powder"
              metalness={0.08}
              roughness={0.3}
              edgeRadius={0.006}
            />
            <Box
              position={[openingWidth * 0.82, openingHeight * 0.52, 0.032]}
              scale={[0.026, openingHeight * 0.34, 0.022]}
              color="#82908d"
              materialKind="aluminum"
              metalness={0.64}
              roughness={0.24}
              edgeRadius={0.003}
            />
          </group>
          <group position={[position[0], position[1] + openingHeight * 0.18, frontZ + 0.06]}>
            <Box
              position={[0, 0.01, 0]}
              scale={[openingWidth * 0.88, 0.025, Math.min(depth * 0.66, 0.34)]}
              color="#aebbb8"
              materialKind="stainless"
              metalness={0.7}
              roughness={0.26}
              edgeRadius={0.003}
            />
            <StoragePreviewContents
              style={contentStyle}
              width={openingWidth * 0.88}
              height={openingHeight}
              depth={Math.min(depth * 0.66, 0.34)}
            />
          </group>
        </>
      )}
    </group>
  );
}

export function Asset3D({
  object,
  room,
  selected,
  hovered,
  detail = "room",
  presentation = "editor",
  showStorageAccess = false,
  onReady,
}: {
  object: SceneObject;
  room: Room;
  selected: boolean;
  hovered: boolean;
  detail?: "room" | "preview";
  presentation?: "editor" | "digital-twin";
  showStorageAccess?: boolean;
  onReady?: (objectId: string) => void;
}) {
  const definition = getAssetDefinition(object.assetDefinitionId);
  const setSelected = useEditorStore((state) => state.setSelected);
  const setHovered = useEditorStore((state) => state.setHovered);
  const selectedLocationId = useEditorStore((state) => state.selectedLocationId);
  const width = mmToMetres(object.dimensions.width);
  const depth = mmToMetres(object.dimensions.depth);
  const height = mmToMetres(object.dimensions.height);
  const x = mmToMetres(object.position.x - room.width / 2);
  const z = mmToMetres(object.position.y - room.depth / 2);
  const elevation = mmToMetres(object.position.z);
  const highlight = selected || hovered;
  const selectedLocation = selected
    ? room.scene.storageLocations.find(
        (location) => location.id === selectedLocationId && location.objectId === object.id,
      )
    : undefined;
  const storageHighlight = selected
    ? storageLocationHighlight(
        selectedLocationId,
        object.id,
        room.scene.storageLocations,
        object.dimensions,
      )
    : null;
  const accessContentStyle = storageAccessContentStyle(
    selectedLocationId,
    room.scene.storageLocations,
    room.scene.inventoryItems,
  );
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    setSelected([object.id], event.shiftKey);
  };
  const common = {
    onClick: click,
    onPointerEnter: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHovered(object.id);
    },
    onPointerLeave: () => setHovered(null),
  };

  return (
    <group
      position={[x, elevation, z]}
      rotation={[0, -THREE.MathUtils.degToRad(object.rotation.z), 0]}
      scale={[object.flipHorizontal ? -1 : 1, 1, object.flipVertical ? -1 : 1]}
      {...common}
    >
      <AssetVisual
        definition={definition}
        width={width}
        depth={depth}
        height={height}
        detail={detail}
        onReady={() => onReady?.(object.id)}
      />
      {highlight && !storageHighlight && (
        <SelectionBounds
          width={width}
          depth={depth}
          height={height}
          precision={presentation === "digital-twin"}
        />
      )}
      {storageHighlight &&
        (presentation === "digital-twin" ? (
          <group
            position={[
              storageHighlight.position[0],
              storageHighlight.position[1],
              storageHighlight.position[2] + storageHighlight.depth / 2 + 0.018,
            ]}
          >
            <SelectionBounds
              width={storageHighlight.width}
              depth={0.018}
              height={storageHighlight.height}
              precision
            />
          </group>
        ) : (
          <group position={storageHighlight.position}>
            <SelectionBounds
              width={storageHighlight.width}
              depth={storageHighlight.depth}
              height={storageHighlight.height}
            />
          </group>
        ))}
      {presentation === "digital-twin" &&
        showStorageAccess &&
        storageHighlight &&
        selectedLocation && (
          <StorageAccessPreview
            position={storageHighlight.position}
            width={storageHighlight.width}
            depth={storageHighlight.depth}
            height={storageHighlight.height}
            locationType={selectedLocation.type}
            contentStyle={accessContentStyle}
          />
        )}
    </group>
  );
}

export type RenderQuality = "performance" | "balanced" | "detail";

function CameraRig({
  room,
  preset,
  focusObjectId,
  focusLocationId,
  presentation,
}: {
  room: Room;
  preset: CameraPreset;
  focusObjectId?: string | null;
  focusLocationId?: string | null;
  presentation: "editor" | "digital-twin";
}) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const setCameraPose = useEditorStore((state) => state.setCameraPose);
  const controls = useRef<any>(null);
  const initializedRoomId = useRef<string | null>(null);
  const transition = useRef<{
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    elapsed: number;
    duration: number;
  } | null>(null);
  // A live scene update is not a camera command. In particular, dragging an
  // object replaces the room/object references on every pointer move. Keep the
  // latest room data available through a ref, but only reframe when the user
  // explicitly changes a preset, room, focused record, or presentation.
  const commandDataRef = useRef({
    room,
    preset,
    focusObjectId,
    focusLocationId,
    presentation,
  });
  useLayoutEffect(() => {
    commandDataRef.current = { room, preset, focusObjectId, focusLocationId, presentation };
  }, [focusLocationId, focusObjectId, presentation, preset, room]);
  const activeCameraCommandKey = cameraCommandKey({
    roomId: room.id,
    presentation,
    preset,
    focusObjectId,
    focusLocationId,
  });

  useFrame((_, delta) => {
    const activeTransition = transition.current;
    if (!activeTransition) return;

    activeTransition.elapsed += Math.min(delta, 0.05);
    const progress = THREE.MathUtils.clamp(
      activeTransition.elapsed / activeTransition.duration,
      0,
      1,
    );
    const eased =
      progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    camera.position.lerpVectors(activeTransition.fromPosition, activeTransition.toPosition, eased);
    const target = new THREE.Vector3().lerpVectors(
      activeTransition.fromTarget,
      activeTransition.toTarget,
      eased,
    );
    controls.current?.target.copy(target);
    camera.lookAt(target);
    controls.current?.update();

    if (progress >= 1) {
      camera.position.copy(activeTransition.toPosition);
      controls.current?.target.copy(activeTransition.toTarget);
      camera.lookAt(activeTransition.toTarget);
      camera.updateProjectionMatrix();
      controls.current?.update();
      transition.current = null;
      return;
    }
    invalidate();
  });

  useEffect(() => {
    const {
      room: commandRoom,
      preset: commandPreset,
      focusObjectId: commandFocusObjectId,
      focusLocationId: commandFocusLocationId,
      presentation: commandPresentation,
    } = commandDataRef.current;
    const savedPose = commandRoom.viewState?.cameraPose;
    if (
      initializedRoomId.current !== commandRoom.id &&
      commandPresentation === "editor" &&
      !commandFocusObjectId &&
      !commandFocusLocationId &&
      savedPose
    ) {
      initializedRoomId.current = commandRoom.id;
      transition.current = null;
      camera.position.set(savedPose.position.x, savedPose.position.y, savedPose.position.z);
      controls.current?.target.set(savedPose.target.x, savedPose.target.y, savedPose.target.z);
      camera.lookAt(savedPose.target.x, savedPose.target.y, savedPose.target.z);
      camera.updateProjectionMatrix();
      controls.current?.update();
      invalidate();
      return;
    }
    initializedRoomId.current = commandRoom.id;
    const roomWidth = mmToMetres(commandRoom.width);
    const roomDepth = mmToMetres(commandRoom.depth);
    const focusObject = commandRoom.scene.objects.find(
      (object) => object.id === commandFocusObjectId,
    );
    const storageHighlight = focusObject
      ? storageLocationHighlight(
          commandFocusLocationId ?? null,
          focusObject.id,
          commandRoom.scene.storageLocations,
          focusObject.dimensions,
        )
      : null;
    const rotatedStorageOffset = storageHighlight
      ? new THREE.Vector3(
          storageHighlight.position[0],
          0,
          storageHighlight.position[2],
        ).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          -THREE.MathUtils.degToRad(focusObject?.rotation.z ?? 0),
        )
      : new THREE.Vector3();
    const target: [number, number, number] = focusObject
      ? [
          mmToMetres(focusObject.position.x - commandRoom.width / 2) + rotatedStorageOffset.x,
          storageHighlight
            ? mmToMetres(focusObject.position.z) +
              storageHighlight.position[1] +
              storageHighlight.height / 2
            : mmToMetres(focusObject.position.z + focusObject.dimensions.height * 0.42),
          mmToMetres(focusObject.position.y - commandRoom.depth / 2) + rotatedStorageOffset.z,
        ]
      : [0, commandPresentation === "digital-twin" ? 0.78 : 0.55, 0];
    const focusedEnvelope = storageHighlight
      ? Math.max(storageHighlight.width, storageHighlight.depth, storageHighlight.height)
      : focusObject
        ? mmToMetres(
            Math.max(
              focusObject.dimensions.width,
              focusObject.dimensions.depth,
              focusObject.dimensions.height,
            ),
          )
        : 0;
    const distance = focusObject
      ? commandFocusLocationId && commandPresentation === "digital-twin"
        ? Math.max(4.8, focusedEnvelope * 5, Math.min(7.2, Math.max(roomWidth, roomDepth) * 0.72))
        : Math.max(
            commandPresentation === "digital-twin" ? 4.4 : 2.8,
            focusedEnvelope * 3.4,
            commandPresentation === "digital-twin" ? Math.max(roomWidth, roomDepth) * 0.55 : 0,
          )
      : Math.max(roomWidth, roomDepth) * (commandPresentation === "digital-twin" ? 0.93 : 1.1);
    const focusApproach = focusObject
      ? digitalTwinCameraApproach({
          roomWidthMm: commandRoom.width,
          roomDepthMm: commandRoom.depth,
          objectXmm: focusObject.position.x,
          objectYmm: focusObject.position.y,
          objectRotationDeg: focusObject.rotation.z,
        })
      : null;
    const digitalTwinFocusPosition: [number, number, number] | null = focusApproach
      ? [
          target[0] + distance * (focusApproach.forwardX * 0.9 + focusApproach.lateralX * 0.22),
          target[1] + distance * (storageHighlight ? 0.58 : 0.66),
          target[2] + distance * (focusApproach.forwardZ * 0.9 + focusApproach.lateralZ * 0.22),
        ]
      : null;
    const positions: Record<CameraPreset, [number, number, number]> = {
      perspective: focusObject
        ? commandPresentation === "digital-twin"
          ? digitalTwinFocusPosition!
          : [target[0] + distance * 0.58, target[1] + distance * 0.92, target[2] + distance * 0.66]
        : commandPresentation === "digital-twin"
          ? [target[0] - distance * 0.42, target[1] + distance * 0.6, target[2] + distance * 0.7]
          : [target[0] + distance * 0.8, target[1] + distance * 0.7, target[2] + distance * 0.9],
      orthographic: [
        target[0] + distance * 0.75,
        target[1] + distance * 0.8,
        target[2] + distance * 0.75,
      ],
      top: [target[0], target[1] + distance * 1.35, target[2] + 0.01],
      isometric: focusObject
        ? commandPresentation === "digital-twin"
          ? digitalTwinFocusPosition!
          : [target[0] + distance * 0.54, target[1] + distance * 1.02, target[2] + distance * 0.58]
        : commandPresentation === "digital-twin"
          ? [target[0] - distance * 0.42, target[1] + distance * 0.6, target[2] + distance * 0.7]
          : editorInitialIsometricPosition({
              roomWidthMetres: roomWidth,
              roomDepthMetres: roomDepth,
              target,
            }),
      front: [target[0], target[1] + distance * 0.45, target[2] + distance * 1.15],
      right: [target[0] + distance * 1.15, target[1] + distance * 0.45, target[2]],
      left: [target[0] - distance * 1.15, target[1] + distance * 0.45, target[2]],
      back: [target[0], target[1] + distance * 0.45, target[2] - distance * 1.15],
    };
    const destinationPosition = new THREE.Vector3(...positions[commandPreset]);
    const destinationTarget = new THREE.Vector3(...target);
    const currentTarget = controls.current?.target.clone() ?? new THREE.Vector3(0, 0.55, 0);
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const movementIsNegligible =
      camera.position.distanceToSquared(destinationPosition) < 0.0001 &&
      currentTarget.distanceToSquared(destinationTarget) < 0.0001;
    if (reducedMotion || movementIsNegligible) {
      transition.current = null;
      camera.position.copy(destinationPosition);
      controls.current?.target.copy(destinationTarget);
      camera.lookAt(destinationTarget);
      camera.updateProjectionMatrix();
      controls.current?.update();
      invalidate();
      return;
    }

    transition.current = {
      fromPosition: camera.position.clone(),
      toPosition: destinationPosition,
      fromTarget: currentTarget,
      toTarget: destinationTarget,
      elapsed: 0,
      duration: commandPresentation === "digital-twin" ? 0.56 : 0.42,
    };
    invalidate();
  }, [camera, activeCameraCommandKey, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={3}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2.04}
      onStart={() => {
        transition.current = null;
      }}
      onEnd={() => {
        const target = controls.current?.target;
        if (!target) return;
        setCameraPose({
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: { x: target.x, y: target.y, z: target.z },
        });
      }}
    />
  );
}

function CameraSystem({
  room,
  focusObjectId,
  focusLocationId,
  presentation,
}: {
  room: Room;
  focusObjectId?: string | null;
  focusLocationId?: string | null;
  presentation: "editor" | "digital-twin";
}) {
  const preset = useEditorStore((state) => state.cameraPreset);
  // The interactive view cube keeps one perspective camera mounted. A true
  // overhead target still reads as Top, without forcing a costly camera/control
  // replacement in the middle of an authored laboratory scene.
  const orthographic = preset === "orthographic";
  return (
    <>
      <PerspectiveCamera
        makeDefault={!orthographic}
        position={DEFAULT_CAMERA_POSITION}
        fov={presentation === "digital-twin" ? 40 : 39}
        near={0.05}
        far={100}
      />
      <OrthographicCamera
        makeDefault={orthographic}
        position={DEFAULT_CAMERA_POSITION}
        zoom={58}
        near={-50}
        far={100}
      />
      <CameraRig
        room={room}
        preset={preset}
        focusObjectId={focusObjectId}
        focusLocationId={focusLocationId}
        presentation={presentation}
      />
    </>
  );
}

const RoomScene = memo(function RoomScene({
  room,
  focusObjectId,
  focusLocationId,
  quality,
  presentation,
  wallTransparentOverride,
  showStorageAccess,
  onAssetReady,
}: {
  room: Room;
  focusObjectId?: string | null;
  focusLocationId?: string | null;
  quality: RenderQuality;
  presentation: "editor" | "digital-twin";
  wallTransparentOverride?: boolean;
  showStorageAccess: boolean;
  onAssetReady?: (objectId: string) => void;
}) {
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const hoveredId = useEditorStore((state) => state.hoveredId);
  const floorVisible = useEditorStore((state) => state.floorVisible);
  const environmentContextVisible = useEditorStore((state) => state.environmentContextVisible);
  const setSelected = useEditorStore((state) => state.setSelected);
  const layers = useMemo(
    () => new Map(room.scene.layers.map((layer) => [layer.id, layer.visible])),
    [room.scene.layers],
  );
  const objects = room.scene.objects.filter((object) => {
    if (!object.visible || layers.get(object.layerId) === false) return false;
    return true;
  });
  const roomWidthMetres = mmToMetres(room.width);
  const roomDepthMetres = mmToMetres(room.depth);
  const hasClosedFloor = useMemo(
    () => Boolean(getClosedWallFloorPolygon(room.scene.objects)),
    [room.scene.objects],
  );
  return (
    <>
      <CameraSystem
        room={room}
        focusObjectId={focusObjectId}
        focusLocationId={focusLocationId}
        presentation={presentation}
      />
      <color attach="background" args={[presentation === "digital-twin" ? "#edf1ee" : "#f4f6f5"]} />
      <LaboratoryEnvironment
        room={room}
        visible={environmentContextVisible}
        overheadVisible={
          environmentContextVisible && (presentation !== "digital-twin" || !wallTransparentOverride)
        }
      />
      <Environment resolution={quality === "detail" ? 256 : 128} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#ffffff"
          position={[4, 8, 6]}
          rotation={[-Math.PI / 4, 0.35, 0]}
          scale={[8, 8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#cde7e3"
          position={[-6, 4, -5]}
          rotation={[0.2, -Math.PI / 3, 0]}
          scale={[6, 4, 1]}
        />
      </Environment>
      <hemisphereLight
        color="#f5fbf8"
        groundColor="#59554d"
        intensity={presentation === "digital-twin" ? 0.34 : 0.34}
      />
      <ambientLight intensity={presentation === "digital-twin" ? 0.075 : 0.16} />
      <directionalLight
        position={[5, 11, 7]}
        intensity={presentation === "digital-twin" ? 1.72 : 1.95}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={26}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      />
      <directionalLight
        position={[-8, 5, -3]}
        color="#d7ece8"
        intensity={presentation === "digital-twin" ? 0.32 : 0.5}
      />
      <directionalLight
        position={[1, 4, -9]}
        color="#fff0dc"
        intensity={presentation === "digital-twin" ? 0.28 : 0.24}
      />
      {presentation === "digital-twin" && (
        <>
          <directionalLight position={[-5, 7.5, 6]} color="#fffaf2" intensity={0.58} />
          {[-0.26, 0.26].map((offset) => (
            <rectAreaLight
              key={`photographic-key-${offset}`}
              color="#f8fffd"
              intensity={4.8}
              width={Math.max(1.9, roomWidthMetres * 0.3)}
              height={0.2}
              position={[roomWidthMetres * offset, 2.82, -roomDepthMetres * 0.18]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
          ))}
          <rectAreaLight
            color="#f4fbf8"
            intensity={4.2}
            width={Math.max(2.2, roomWidthMetres * 0.36)}
            height={0.2}
            position={[0, 2.82, roomDepthMetres * 0.24]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        </>
      )}
      {floorVisible && hasClosedFloor && (
        <RoomFloor3D room={room} onClearSelection={() => setSelected([])} />
      )}
      {objects
        .filter((object) => object.objectType === "wall")
        .map((wall) => (
          <Wall3D
            key={wall.id}
            wall={wall}
            room={room}
            transparentOverride={wallTransparentOverride}
            presentation={presentation}
          />
        ))}
      <WallJoints3D
        walls={objects.filter((object) => object.objectType === "wall")}
        room={room}
        presentation={presentation}
        transparentOverride={wallTransparentOverride}
      />
      {objects
        .filter((object) => object.objectType === "door" || object.objectType === "window")
        .map((opening) => (
          <Opening3D
            key={opening.id}
            object={opening}
            room={room}
            selected={selectedIds.includes(opening.id)}
            transparentOverride={wallTransparentOverride}
            presentation={presentation}
          />
        ))}
      {objects
        .filter(
          (object) =>
            !["wall", "door", "window", "label", "measurement"].includes(object.objectType),
        )
        .map((object) => (
          <Asset3D
            key={object.id}
            object={object}
            room={room}
            selected={selectedIds.includes(object.id)}
            hovered={hoveredId === object.id}
            presentation={presentation}
            showStorageAccess={showStorageAccess}
            onReady={onAssetReady}
          />
        ))}
      {floorVisible && hasClosedFloor && (
        <ContactShadows
          position={[0, 0.008, 0]}
          opacity={presentation === "digital-twin" ? 0.46 : 0.3}
          scale={Math.max(roomWidthMetres, roomDepthMetres) * 1.25}
          blur={presentation === "digital-twin" ? 2.05 : 2.8}
          far={presentation === "digital-twin" ? 4.2 : 3.2}
          resolution={quality === "detail" ? 2048 : quality === "performance" ? 512 : 1024}
          frames={1}
          color="#27302e"
        />
      )}
      {presentation === "editor" && (
        <Grid
          args={[30, 30]}
          cellSize={0.5}
          cellThickness={0.35}
          cellColor="#c9cfcd"
          sectionSize={1}
          sectionThickness={0.7}
          sectionColor="#aeb8b5"
          fadeDistance={22}
          fadeStrength={1}
          infiniteGrid
          position={[0, -0.012, 0]}
        />
      )}
    </>
  );
});

function ViewCube({
  preset,
  onChange,
}: {
  preset: CameraPreset;
  onChange: (preset: CameraPreset) => void;
}) {
  return (
    <div className="view-cube-control" role="group" aria-label="3D orientation">
      <svg className="view-cube" viewBox="0 0 112 112" aria-hidden="true">
        <polygon className={preset === "top" ? "active" : ""} points="56,12 94,32 56,52 18,32" />
        <polygon className={preset === "left" ? "active" : ""} points="18,32 56,52 56,96 18,74" />
        <polygon className={preset === "front" ? "active" : ""} points="56,52 94,32 94,74 56,96" />
        <text x="56" y="34">
          T
        </text>
        <text x="37" y="66">
          L
        </text>
        <text x="75" y="66">
          F
        </text>
      </svg>
      <button
        className={`view-cube-face view-cube-face-top ${preset === "top" ? "active" : ""}`}
        aria-label="Top view"
        aria-pressed={preset === "top"}
        onClick={() => onChange("top")}
      />
      <button
        className={`view-cube-face view-cube-face-left ${preset === "left" ? "active" : ""}`}
        aria-label="Left view"
        aria-pressed={preset === "left"}
        onClick={() => onChange("left")}
      />
      <button
        className={`view-cube-face view-cube-face-front ${preset === "front" ? "active" : ""}`}
        aria-label="Front view"
        aria-pressed={preset === "front"}
        onClick={() => onChange("front")}
      />
      <button
        className={`view-cube-home ${preset === "isometric" ? "active" : ""}`}
        onClick={() => onChange("isometric")}
        title="Isometric view"
        aria-label="Isometric view"
        aria-pressed={preset === "isometric"}
      >
        <Cube size={12} weight="duotone" />
      </button>
      {/* The faces are deliberately separate native buttons. This keeps the
          compact visual while preserving full keyboard and screen-reader use. */}
    </div>
  );
}

export function ThreeDView({
  quality = "balanced",
  focusObjectId: focusObjectIdOverride,
  focusLocationId: focusLocationIdOverride,
  presentation = "editor",
  wallTransparentOverride,
  showStorageAccess: showStorageAccessOverride,
}: {
  quality?: RenderQuality;
  focusObjectId?: string | null;
  focusLocationId?: string | null;
  presentation?: "editor" | "digital-twin";
  wallTransparentOverride?: boolean;
  showStorageAccess?: boolean;
} = {}) {
  const [materialMapsReady, setMaterialMapsReady] = useState(false);
  const [readySceneSignature, setReadySceneSignature] = useState<string | null>(null);
  const readyAssetIds = useRef(new Set<string>());
  const sceneReadyFrame = useRef<number | null>(null);
  const modelProgress = useProgress();
  const room = useEditorStore(selectActiveRoom);
  const spatialFocus = useEditorStore((state) => state.spatialFocus);
  const focusObjectId =
    focusObjectIdOverride === undefined
      ? spatialFocus?.roomId === room.id
        ? spatialFocus.objectId
        : null
      : focusObjectIdOverride;
  const focusLocationId =
    focusLocationIdOverride === undefined
      ? spatialFocus?.roomId === room.id
        ? spatialFocus.locationId
        : null
      : focusLocationIdOverride;
  const showStorageAccess =
    showStorageAccessOverride === undefined
      ? Boolean(spatialFocus?.roomId === room.id && spatialFocus.showStorageAccess)
      : showStorageAccessOverride;
  const preset = useEditorStore((state) => state.cameraPreset);
  const setPreset = useEditorStore((state) => state.setCameraPreset);
  const floorVisible = useEditorStore((state) => state.floorVisible);
  const wallTransparent = useEditorStore((state) => state.wallTransparent);
  const environmentContextVisible = useEditorStore((state) => state.environmentContextVisible);
  const toggleFloor = useEditorStore((state) => state.toggleFloor);
  const toggleWalls = useEditorStore((state) => state.toggleWalls);
  const toggleEnvironmentContext = useEditorStore((state) => state.toggleEnvironmentContext);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selected = room.scene.objects.find((object) => object.id === selectedIds[0]);
  const visibleAssetIds = useMemo(() => {
    const visibleLayers = new Map(room.scene.layers.map((layer) => [layer.id, layer.visible]));
    return room.scene.objects
      .filter(
        (object) =>
          object.visible &&
          visibleLayers.get(object.layerId) !== false &&
          !["wall", "door", "window", "label", "measurement"].includes(object.objectType),
      )
      .map((object) => object.id)
      .sort();
  }, [room.scene.layers, room.scene.objects]);
  const sceneLoadSignature = `${room.id}:${visibleAssetIds.join("|")}`;
  const activeCameraCommandKey = cameraCommandKey({
    roomId: room.id,
    presentation,
    preset,
    focusObjectId,
    focusLocationId,
  });
  const sceneReady = visibleAssetIds.length === 0 || readySceneSignature === sceneLoadSignature;
  const hasClosedFloor = useMemo(
    () => Boolean(getClosedWallFloorPolygon(room.scene.objects)),
    [room.scene.objects],
  );

  useLayoutEffect(() => {
    readyAssetIds.current.clear();
    if (sceneReadyFrame.current !== null) cancelAnimationFrame(sceneReadyFrame.current);
    return () => {
      if (sceneReadyFrame.current !== null) cancelAnimationFrame(sceneReadyFrame.current);
    };
  }, [sceneLoadSignature, visibleAssetIds.length]);

  const markAssetReady = useCallback(
    (objectId: string) => {
      readyAssetIds.current.add(objectId);
      if (readyAssetIds.current.size < visibleAssetIds.length || sceneReadyFrame.current !== null) {
        return;
      }
      // Hold the progress surface until the demand-rendered canvas has painted
      // the complete authored scene, not merely finished decoding its files.
      sceneReadyFrame.current = requestAnimationFrame(() => {
        sceneReadyFrame.current = requestAnimationFrame(() => {
          sceneReadyFrame.current = null;
          setReadySceneSignature(sceneLoadSignature);
        });
      });
    },
    [sceneLoadSignature, visibleAssetIds.length],
  );

  useEffect(() => {
    let active = true;
    void waitForLaboratoryMaterialTextures().then(() => {
      if (active) setMaterialMapsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      className="three-d-view"
      data-testid="3d-view"
      data-render-quality={quality}
      data-presentation={presentation}
      data-focus-object-id={focusObjectId ?? undefined}
      data-focus-location-id={focusLocationId ?? undefined}
      data-storage-access-open={showStorageAccess ? "true" : "false"}
      data-visible-asset-count={visibleAssetIds.length}
      data-scene-scope="full"
      data-floor-state={hasClosedFloor ? "wall-derived" : "awaiting-closed-walls"}
      data-camera-command-key={activeCameraCommandKey}
      aria-label="Synchronized 3D room view"
    >
      <div className="three-d-toolbar">
        <ViewCube preset={preset} onChange={setPreset} />
        <div className="three-d-actions">
          {hasLaboratoryEnvironmentProfile(room) && (
            <button
              data-testid="lab-environment-context-toggle"
              className={environmentContextVisible ? "active" : ""}
              onClick={toggleEnvironmentContext}
              title={
                environmentContextVisible
                  ? "Hide ceiling and services"
                  : "Show ceiling and services"
              }
              aria-label={
                environmentContextVisible
                  ? "Hide ceiling and services"
                  : "Show ceiling and services"
              }
              aria-pressed={environmentContextVisible}
            >
              <PlugsConnected size={17} weight="duotone" />
            </button>
          )}
          <button
            className={wallTransparent ? "active" : ""}
            onClick={toggleWalls}
            title={wallTransparent ? "Show solid walls" : "Make walls transparent"}
            aria-label={wallTransparent ? "Show solid walls" : "Make walls transparent"}
            aria-pressed={wallTransparent}
          >
            <SquareSplitHorizontal size={17} />
          </button>
          <button
            className={floorVisible ? "active" : ""}
            onClick={toggleFloor}
            title={
              hasClosedFloor
                ? floorVisible
                  ? "Hide floor"
                  : "Show floor"
                : "Close the wall outline to generate a floor"
            }
            aria-label={hasClosedFloor ? "Toggle floor visibility" : "Floor awaiting closed walls"}
            aria-pressed={floorVisible}
            disabled={!hasClosedFloor}
          >
            <Eye size={17} />
          </button>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="view-loading">
            <span />
            Preparing spatial view…
          </div>
        }
      >
        <Canvas
          shadows={{ type: THREE.PCFSoftShadowMap }}
          dpr={quality === "detail" ? [1.25, 2] : quality === "performance" ? [0.75, 1] : [1, 1.5]}
          frameloop="demand"
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = presentation === "digital-twin" ? 1.04 : 0.98;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
          onPointerMissed={() => useEditorStore.getState().setSelected([])}
        >
          <RoomScene
            room={room}
            focusObjectId={focusObjectId}
            focusLocationId={focusLocationId}
            quality={quality}
            presentation={presentation}
            wallTransparentOverride={wallTransparentOverride}
            showStorageAccess={showStorageAccess}
            onAssetReady={markAssetReady}
          />
        </Canvas>
      </Suspense>
      {(modelProgress.active || !materialMapsReady || !sceneReady) && (
        <div className="spatial-model-loading" role="status" aria-live="polite">
          <div className="spatial-model-loading-card">
            <div className="spatial-model-loading-mark" aria-hidden="true">
              <Cube size={24} weight="duotone" />
            </div>
            <div className="spatial-model-loading-copy">
              <small>Authored spatial model</small>
              <b>Assembling {room.name}</b>
              <span>
                {modelProgress.active && modelProgress.total > 0
                  ? `${modelProgress.loaded} of ${modelProgress.total} model resources`
                  : !materialMapsReady
                    ? "Preparing laboratory material maps"
                    : "Finalizing room lighting and reflections"}
              </span>
            </div>
            <div
              className="spatial-model-loading-track"
              aria-label={`${Math.round(modelProgress.active ? modelProgress.progress : sceneReady ? 100 : 96)}% loaded`}
            >
              <span
                style={{
                  width: `${Math.max(
                    5,
                    modelProgress.active ? modelProgress.progress : sceneReady ? 100 : 96,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
      {selected && (
        <div className="selection-trace-card">
          <SelectionAll size={16} weight="duotone" />
          <span>
            <b>{selected.name}</b>
            {selected.indexCode}
          </span>
        </div>
      )}
    </section>
  );
}
