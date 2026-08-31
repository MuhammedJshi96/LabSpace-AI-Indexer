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
  Grid,
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
import { StudioEnvironment } from "./StudioEnvironment";
import { getAssetDefinition } from "../domain/assets";
import {
  cameraCommandKey,
  digitalTwinCameraApproach,
  editorInitialIsometricPosition,
  isCameraFocusClear,
  type CameraCommandInput,
} from "../domain/camera-command";
import { shouldCutawayWall } from "../domain/digital-twin-cutaway";
import { mmToMetres, wallAngle, wallLength } from "../domain/geometry";
import { hasLaboratoryEnvironmentProfile } from "../domain/laboratory-environment";
import { wallFinishForObject } from "../domain/laboratory-wall-materials";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import { waitForLaboratoryMaterialTextures } from "../lib/laboratory-material-textures";
import type { Room, SceneObject } from "../domain/schema";
import { storageLocationHighlight } from "../domain/storage-highlight";
import { resolveStorageAccess } from "../domain/storage-access";
import { resolveHostedOpening } from "../domain/wall-openings";
import { selectActiveRoom, useEditorStore, type CameraPreset } from "../store/editor-store";
import { ModelBox as Box, ProceduralAssetModel, SelectionBounds } from "./ProceduralAssetModel";
import { AssetVisual } from "./AssetVisual";
import { LaboratoryEnvironment } from "./LaboratoryEnvironment";
import { RoomFloor3D } from "./RoomFloor3D";
import { RoomWallBlock } from "./RoomWallBlock";
import { roomLightingLayout } from "../domain/room-lighting";

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

  return (
    <group ref={wallGroupRef} position={[startX, 0, startZ]} rotation={[0, -angle, 0]}>
      {spans.map((span, index) => {
        const renderStart = span.start;
        const renderEnd = span.end;
        const renderLength = Math.max(0.01, renderEnd - renderStart);
        return (
          <group key={`span-${index}`}>
            <RoomWallBlock
              position={[(renderStart + renderEnd) / 2, height / 2, 0]}
              size={[renderLength, height, thickness]}
              finish={finish}
              opacity={opacity}
            />
            <Box
              position={[(renderStart + renderEnd) / 2, 0.047, -thickness * 0.53]}
              scale={[renderLength, 0.094, 0.018]}
              color={finish.baseboardColor}
              opacity={opacity}
              metalness={0}
              roughness={0.65}
              materialKind="rubber"
              clearcoat={0}
              envMapIntensity={0.65}
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
              <RoomWallBlock
                position={[(start + end) / 2, sill / 2, 0]}
                size={[openingWidth, sill, thickness]}
                finish={finish}
                opacity={opacity}
              />
            )}
            {height > sill + openingHeight && (
              <RoomWallBlock
                position={[
                  (start + end) / 2,
                  sill + openingHeight + (height - sill - openingHeight) / 2,
                  0,
                ]}
                size={[openingWidth, height - sill - openingHeight, thickness]}
                finish={finish}
                opacity={opacity}
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
  return (
    <group ref={groupRef}>
      {joints.map((joint, index) => {
        const thickness = Math.max(...joint.walls.map((wall) => wall.wall!.thickness));
        const height = Math.max(...joint.walls.map((wall) => wall.wall!.height));
        const finish = wallFinishForObject(joint.walls[0].metadata, room.wallFinish);
        return (
          <RoomWallBlock
            key={`${Math.round(joint.point.x)}-${Math.round(joint.point.y)}-${index}`}
            position={[
              mmToMetres(joint.point.x - room.width / 2),
              mmToMetres(height) / 2,
              mmToMetres(joint.point.y - room.depth / 2),
            ]}
            size={[mmToMetres(thickness) * 1.01, mmToMetres(height), mmToMetres(thickness) * 1.01]}
            finish={finish}
            opacity={wallTransparent && presentation === "editor" ? 0.28 : 1}
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
        if (event.detail > 1) return;
        setSelected(selected && !event.shiftKey ? [] : [object.id], event.shiftKey);
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

export function Asset3D({
  object,
  room,
  selected,
  hovered,
  detail = "room",
  presentation = "editor",
  showStorageAccess = false,
  onReady,
  interactive = true,
}: {
  object: SceneObject;
  room: Room;
  selected: boolean;
  hovered: boolean;
  detail?: "room" | "preview";
  presentation?: "editor" | "digital-twin";
  showStorageAccess?: boolean;
  onReady?: (objectId: string) => void;
  interactive?: boolean;
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
  const access = resolveStorageAccess(
    definition.id,
    object.id,
    selected ? selectedLocationId : null,
    room.scene.storageLocations,
  );
  const storageHighlight =
    selected && access.region
      ? {
          position: [
            access.region.x * width,
            access.region.y * height,
            access.region.z * depth,
          ] as [number, number, number],
          width: access.region.width * width,
          height: access.region.height * height,
          depth: 0,
        }
      : selected
        ? storageLocationHighlight(
            selectedLocationId,
            object.id,
            room.scene.storageLocations,
            object.dimensions,
          )
        : null;
  const sideAccess = Boolean(access.region && (access.region.depth ?? 0) > access.region.width * 3);
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.detail > 1) return;
    setSelected(selected && !event.shiftKey ? [] : [object.id], event.shiftKey);
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
      {...(interactive ? common : {})}
    >
      <AssetVisual
        definition={definition}
        width={width}
        depth={depth}
        height={height}
        detail={detail}
        openStorageParts={
          presentation === "digital-twin" && showStorageAccess
            ? access.parts.map((part) => part.id)
            : []
        }
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
            rotation={sideAccess ? [0, Math.PI / 2, 0] : [0, 0, 0]}
            position={[
              storageHighlight.position[0],
              storageHighlight.position[1],
              storageHighlight.position[2] + storageHighlight.depth / 2 + 0.018,
            ]}
          >
            <SelectionBounds
              width={sideAccess ? (access.region?.depth ?? 0) * depth : storageHighlight.width}
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
  const previousCommandRef = useRef<CameraCommandInput | null>(null);
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
    const command = {
      roomId: commandRoom.id,
      preset: commandPreset,
      focusObjectId: commandFocusObjectId,
      focusLocationId: commandFocusLocationId,
      presentation: commandPresentation,
    };
    const clearingFocus = isCameraFocusClear(previousCommandRef.current, command);
    previousCommandRef.current = command;
    if (clearingFocus) {
      // Dismissing evidence removes its trace, not the user's current viewpoint.
      transition.current = null;
      invalidate();
      return;
    }
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
  sceneReady,
}: {
  room: Room;
  focusObjectId?: string | null;
  focusLocationId?: string | null;
  quality: RenderQuality;
  presentation: "editor" | "digital-twin";
  wallTransparentOverride?: boolean;
  showStorageAccess: boolean;
  onAssetReady?: (objectId: string) => void;
  sceneReady: boolean;
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
  const lighting = roomLightingLayout(room.width, room.depth, room.wallHeight);
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
      <StudioEnvironment intensity={lighting.environmentIntensity} />
      <hemisphereLight color="#f7f9ff" groundColor="#c4bfb5" intensity={0.28} />
      <directionalLight
        position={lighting.keyPosition}
        intensity={lighting.keyIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-radius={2.5}
        shadow-intensity={lighting.shadowIntensity}
        shadow-camera-near={1}
        shadow-camera-far={lighting.shadowFar}
        shadow-camera-left={-lighting.shadowExtent}
        shadow-camera-right={lighting.shadowExtent}
        shadow-camera-top={lighting.shadowExtent}
        shadow-camera-bottom={-lighting.shadowExtent}
        shadow-bias={-0.0002}
        shadow-normalBias={0.004}
      />
      <directionalLight position={[-8, 5, -3]} color="#eef1f4" intensity={0.22} />
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
      {floorVisible && hasClosedFloor && sceneReady && (
        <ContactShadows
          position={[0, 0.008, 0]}
          opacity={0.36}
          scale={Math.max(roomWidthMetres, roomDepthMetres) * 1.25}
          blur={2.4}
          far={lighting.contactFar}
          resolution={quality === "performance" ? 512 : 1024}
          frames={2}
          color="#353a3e"
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
  useEffect(() => {
    const clear = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key !== "Escape" || event.defaultPrevented || useEditorStore.getState().dialog)
        return;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      )
        return;
      useEditorStore.getState().setSelected([]);
    };
    window.addEventListener("keydown", clear);
    return () => window.removeEventListener("keydown", clear);
  }, []);
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
      data-surface-renderer="satin-grain-v1"
      data-presentation={presentation}
      data-focus-object-id={focusObjectId ?? undefined}
      data-focus-location-id={focusLocationId ?? undefined}
      data-storage-access-open={showStorageAccess ? "true" : "false"}
      data-scene-ready={sceneReady && materialMapsReady && !modelProgress.active ? "true" : "false"}
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
          shadows={{ type: THREE.PCFShadowMap }}
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
            sceneReady={sceneReady}
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
