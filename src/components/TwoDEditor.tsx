import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  Arc,
  Arrow,
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { getAssetDefinition } from "../domain/assets";
import {
  findBenchSupport,
  objectBounds,
  requiresBenchSupport,
  snapBenchObjectToAvailableSupport,
  snapPoint,
  snapValue,
  validatePlacement,
} from "../domain/geometry";
import {
  getClosedWallFloorPolygon,
  getRoomFloorPlan,
  synchronizeClosedRoomAfterWallEdit,
} from "../domain/room-geometry";
import { wallFinishForObject } from "../domain/laboratory-wall-materials";
import type { SceneObject } from "../domain/schema";
import { advanceWallChain, type WallPoint } from "../domain/wall-drawing";
import { editWallEndpoint, translateWall, type WallEndpoint } from "../domain/wall-editing";
import {
  findNearestWallProjection,
  hostOpeningAtPoint,
  openingOverlapsSibling,
  resolveHostedOpening,
} from "../domain/wall-openings";
import { useAssetRenderImage } from "../hooks/useAssetRenderImage";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";
import { RoomFloorPlanShape } from "./RoomFloorPlan";

const objectColors: Record<string, { fill: string; stroke: string; accent: string }> = {
  white: { fill: "#e8eceb", stroke: "#65716f", accent: "#a6b0ad" },
  steel: { fill: "#c2cbca", stroke: "#53605f", accent: "#84918f" },
  dark: { fill: "#3b4548", stroke: "#12191b", accent: "#8d9a99" },
  glass: { fill: "#b8d9dc", stroke: "#557b80", accent: "#78aeb4" },
  yellow: { fill: "#e5c84c", stroke: "#79691e", accent: "#b99721" },
  red: { fill: "#cf6962", stroke: "#7c3532", accent: "#9e423d" },
  blue: { fill: "#6d98ae", stroke: "#345464", accent: "#49768c" },
};

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 900, height: 700 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width > 1 && height > 1) setSize({ width, height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

type PlanBounds = ReturnType<typeof getRoomFloorPlan>["bounds"];

function PlanDimensionFrame({ bounds, scale }: { bounds: PlanBounds; scale: number }) {
  const screen = (value: number) => value / scale;
  const topDimensionY = bounds.minY - screen(34);
  const leftDimensionX = bounds.minX - screen(34);
  const labelWidth = screen(88);
  const labelHeight = screen(22);
  const extensionGap = screen(5);
  const extensionOverrun = screen(6);
  const commonLine = {
    stroke: "#53615f",
    strokeWidth: screen(1),
    listening: false,
  } as const;

  return (
    <Group listening={false} name="room-dimension-frame">
      <Line
        points={[
          bounds.minX,
          bounds.minY - extensionGap,
          bounds.minX,
          topDimensionY - extensionOverrun,
        ]}
        {...commonLine}
      />
      <Line
        points={[
          bounds.maxX,
          bounds.minY - extensionGap,
          bounds.maxX,
          topDimensionY - extensionOverrun,
        ]}
        {...commonLine}
      />
      <Arrow
        points={[bounds.minX, topDimensionY, bounds.maxX, topDimensionY]}
        pointerAtBeginning
        pointerAtEnding
        pointerLength={screen(7)}
        pointerWidth={screen(7)}
        fill="#53615f"
        {...commonLine}
      />
      <Group x={(bounds.minX + bounds.maxX) / 2} y={topDimensionY}>
        <Rect
          x={-labelWidth / 2}
          y={-labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          cornerRadius={screen(4)}
          fill="rgba(252,253,253,0.96)"
          stroke="#cbd4d1"
          strokeWidth={screen(0.75)}
        />
        <Text
          x={-labelWidth / 2}
          y={-labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          text={`${(bounds.width / 1000).toFixed(2)} m`}
          align="center"
          verticalAlign="middle"
          fontFamily="Bahnschrift, Segoe UI"
          fontSize={screen(12)}
          fontStyle="600"
          fill="#273433"
        />
      </Group>

      <Line
        points={[
          bounds.minX - extensionGap,
          bounds.minY,
          leftDimensionX - extensionOverrun,
          bounds.minY,
        ]}
        {...commonLine}
      />
      <Line
        points={[
          bounds.minX - extensionGap,
          bounds.maxY,
          leftDimensionX - extensionOverrun,
          bounds.maxY,
        ]}
        {...commonLine}
      />
      <Arrow
        points={[leftDimensionX, bounds.minY, leftDimensionX, bounds.maxY]}
        pointerAtBeginning
        pointerAtEnding
        pointerLength={screen(7)}
        pointerWidth={screen(7)}
        fill="#53615f"
        {...commonLine}
      />
      <Group x={leftDimensionX} y={(bounds.minY + bounds.maxY) / 2} rotation={-90}>
        <Rect
          x={-labelWidth / 2}
          y={-labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          cornerRadius={screen(4)}
          fill="rgba(252,253,253,0.96)"
          stroke="#cbd4d1"
          strokeWidth={screen(0.75)}
        />
        <Text
          x={-labelWidth / 2}
          y={-labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          text={`${(bounds.depth / 1000).toFixed(2)} m`}
          align="center"
          verticalAlign="middle"
          fontFamily="Bahnschrift, Segoe UI"
          fontSize={screen(12)}
          fontStyle="600"
          fill="#273433"
        />
      </Group>
    </Group>
  );
}

function ScreenLabel({
  x,
  y,
  text,
  scale,
  rotation = 0,
  tone = "technical",
}: {
  x: number;
  y: number;
  text: string;
  scale: number;
  rotation?: number;
  tone?: "technical" | "opening" | "clearance";
}) {
  const width = Math.max(70, Math.min(156, text.length * 6.4 + 18)) / scale;
  const height = 21 / scale;
  const palette =
    tone === "opening"
      ? { fill: "rgba(235,248,248,.97)", stroke: "#87bfc4", text: "#225f66" }
      : tone === "clearance"
        ? { fill: "rgba(255,249,232,.97)", stroke: "#d6b866", text: "#6b5317" }
        : { fill: "rgba(250,252,251,.97)", stroke: "#b9c8c4", text: "#314541" };
  return (
    <Group x={x} y={y} rotation={rotation} listening={false}>
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        cornerRadius={4 / scale}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth={0.8 / scale}
        shadowColor="rgba(16,35,31,.16)"
        shadowBlur={4 / scale}
        shadowOffsetY={1 / scale}
      />
      <Text
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        text={text}
        align="center"
        verticalAlign="middle"
        fontFamily="Bahnschrift, Segoe UI"
        fontSize={11 / scale}
        fontStyle="600"
        fill={palette.text}
      />
    </Group>
  );
}

function readablePlanAngle(angle: number) {
  const normalized = ((angle + 180) % 360) - 180;
  return normalized > 90 ? normalized - 180 : normalized < -90 ? normalized + 180 : normalized;
}

function WallLengthMeasurements({ objects, scale }: { objects: SceneObject[]; scale: number }) {
  return (
    <Group name="automatic-wall-measurements" listening={false}>
      {objects
        .filter((object) => object.visible && object.wall)
        .map((object) => {
          const wall = object.wall!;
          const dx = wall.end.x - wall.start.x;
          const dy = wall.end.y - wall.start.y;
          const length = Math.hypot(dx, dy);
          if (length < 500) return null;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const normal = { x: -dy / length, y: dx / length };
          const offset = 18 / scale;
          return (
            <ScreenLabel
              key={`wall-measure-${object.id}`}
              x={(wall.start.x + wall.end.x) / 2 + normal.x * offset}
              y={(wall.start.y + wall.end.y) / 2 + normal.y * offset}
              text={`${(length / 1000).toFixed(2)} m`}
              scale={scale}
              rotation={readablePlanAngle(angle)}
            />
          );
        })}
    </Group>
  );
}

function OpeningMeasurements({ objects, scale }: { objects: SceneObject[]; scale: number }) {
  return (
    <Group name="automatic-opening-measurements" listening={false}>
      {objects
        .filter(
          (object) => object.visible && ["door", "window"].includes(object.objectType),
        )
        .map((object) => {
          const hosted = resolveHostedOpening(object, objects);
          const point = hosted?.point ?? object.position;
          const angle = hosted?.rotation ?? object.rotation.z;
          const radians = (angle * Math.PI) / 180;
          const normal = { x: -Math.sin(radians), y: Math.cos(radians) };
          const type = object.objectType === "door" ? "D" : "W";
          const sill = object.objectType === "window" ? ` · sill ${(object.position.z / 1000).toFixed(2)}` : "";
          return (
            <ScreenLabel
              key={`opening-measure-${object.id}`}
              x={point.x + normal.x * (30 / scale)}
              y={point.y + normal.y * (30 / scale)}
              text={`${type} ${(object.dimensions.width / 1000).toFixed(2)} × ${(object.dimensions.height / 1000).toFixed(2)}${sill}`}
              scale={scale}
              rotation={readablePlanAngle(angle)}
              tone="opening"
            />
          );
        })}
    </Group>
  );
}

type ClearanceSpan = {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  label: string;
};

function selectedClearanceSpans(
  selected: SceneObject,
  objects: SceneObject[],
  bounds: PlanBounds,
): ClearanceSpan[] {
  const target = objectBounds(selected);
  const obstacles = objects
    .filter(
      (object) =>
        object.id !== selected.id &&
        object.visible &&
        !["wall", "door", "window", "label", "measurement"].includes(object.objectType),
    )
    .map((object) => objectBounds(object));
  const overlapsVertically = (entry: ReturnType<typeof objectBounds>) =>
    entry.bottom > target.top && entry.top < target.bottom;
  const overlapsHorizontally = (entry: ReturnType<typeof objectBounds>) =>
    entry.right > target.left && entry.left < target.right;
  const leftEdge = Math.max(
    bounds.minX,
    ...obstacles.filter((entry) => overlapsVertically(entry) && entry.right <= target.left).map((entry) => entry.right),
  );
  const rightEdge = Math.min(
    bounds.maxX,
    ...obstacles.filter((entry) => overlapsVertically(entry) && entry.left >= target.right).map((entry) => entry.left),
  );
  const topEdge = Math.max(
    bounds.minY,
    ...obstacles.filter((entry) => overlapsHorizontally(entry) && entry.bottom <= target.top).map((entry) => entry.bottom),
  );
  const bottomEdge = Math.min(
    bounds.maxY,
    ...obstacles.filter((entry) => overlapsHorizontally(entry) && entry.top >= target.bottom).map((entry) => entry.top),
  );
  const centerX = (target.left + target.right) / 2;
  const centerY = (target.top + target.bottom) / 2;
  const spans = [
    { id: "left", start: { x: leftEdge, y: centerY }, end: { x: target.left, y: centerY } },
    { id: "right", start: { x: target.right, y: centerY }, end: { x: rightEdge, y: centerY } },
    { id: "top", start: { x: centerX, y: topEdge }, end: { x: centerX, y: target.top } },
    { id: "bottom", start: { x: centerX, y: target.bottom }, end: { x: centerX, y: bottomEdge } },
  ];
  return spans
    .map((span) => {
      const gap = Math.hypot(span.end.x - span.start.x, span.end.y - span.start.y);
      return { ...span, label: `${(gap / 1000).toFixed(2)} m` };
    })
    .filter((span) => {
      const gap = Math.hypot(span.end.x - span.start.x, span.end.y - span.start.y);
      return gap >= 80 && gap <= 12_000;
    });
}

function ClearanceMeasurements({
  selected,
  objects,
  bounds,
  scale,
}: {
  selected: SceneObject;
  objects: SceneObject[];
  bounds: PlanBounds;
  scale: number;
}) {
  const spans = selectedClearanceSpans(selected, objects, bounds);
  return (
    <Group name="automatic-clearance-measurements" listening={false}>
      {spans.map((span) => {
        const middle = {
          x: (span.start.x + span.end.x) / 2,
          y: (span.start.y + span.end.y) / 2,
        };
        const horizontal = Math.abs(span.end.x - span.start.x) >= Math.abs(span.end.y - span.start.y);
        return (
          <Group key={`clearance-${span.id}`}>
            <Arrow
              points={[span.start.x, span.start.y, span.end.x, span.end.y]}
              pointerAtBeginning
              pointerAtEnding
              pointerLength={5 / scale}
              pointerWidth={5 / scale}
              stroke="#a27b24"
              fill="#a27b24"
              strokeWidth={1 / scale}
              dash={[5 / scale, 3 / scale]}
            />
            <ScreenLabel
              x={middle.x}
              y={middle.y + (horizontal ? -14 / scale : 0)}
              text={span.label}
              scale={scale}
              rotation={horizontal ? 0 : -90}
              tone="clearance"
            />
          </Group>
        );
      })}
    </Group>
  );
}

function PlanObject({
  object,
  selected,
  scale,
  register,
}: {
  object: SceneObject;
  selected: boolean;
  scale: number;
  register: (id: string, node: Konva.Group | null) => void;
}) {
  const definition = getAssetDefinition(object.assetDefinitionId);
  const palette = objectColors[definition.material] ?? objectColors.white;
  const tool = useEditorStore((state) => state.tool);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridSize = useEditorStore((state) => state.gridSize);
  const snapTolerance = useEditorStore((state) => state.snapTolerance);
  const hovered = useEditorStore((state) => state.hoveredId === object.id);
  const room = useEditorStore(selectActiveRoom);
  const setSelected = useEditorStore((state) => state.setSelected);
  const setHovered = useEditorStore((state) => state.setHovered);
  const previewObject = useEditorStore((state) => state.previewObject);
  const commitPreview = useEditorStore((state) => state.commitPreview);
  const setGuides = useEditorStore((state) => state.setGuides);
  const updateObject = useEditorStore((state) => state.updateObject);
  const pushToast = useEditorStore((state) => state.pushToast);
  const beforeRef = useRef<SceneObject | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const layer = room.scene.layers.find((entry) => entry.id === object.layerId);
  const locked = object.locked || layer?.locked;
  const agentPlanPreview = object.metadata.agentPlanPreview === true;
  const width = object.dimensions.width;
  const depth = object.dimensions.depth;
  const profile = definition.profile;
  const { image: planImage, status: planImageStatus } = useAssetRenderImage(definition, {
    dimensions: object.dimensions,
    enabled: true,
    longestEdge: 240,
  });

  const selectObject = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== "select") return;
    event.cancelBubble = true;
    const additive = "shiftKey" in event.evt && event.evt.shiftKey;
    if (additive && selectedIds.includes(object.id))
      setSelected(selectedIds.filter((id) => id !== object.id));
    else setSelected([object.id], additive);
  };

  return (
    <>
      <Group
        ref={(node) => register(object.id, node)}
        name={`scene-object ${object.objectType}`}
        x={object.position.x}
        y={object.position.y}
        rotation={object.rotation.z}
        opacity={agentPlanPreview ? 0.72 : 1}
        draggable={tool === "select" && !locked}
        onClick={selectObject}
        onTap={selectObject}
        onMouseEnter={() => setHovered(object.id)}
        onMouseLeave={() => setHovered(null)}
        onDragStart={(event) => {
          beforeRef.current = structuredClone(object);
          if (!selectedIds.includes(object.id)) setSelected([object.id]);
          const stage = event.target.getStage();
          const parent = event.target.getParent();
          const pointerPosition = stage?.getPointerPosition();
          if (parent && pointerPosition) {
            const scenePoint = parent.getAbsoluteTransform().copy().invert().point(pointerPosition);
            dragOffsetRef.current = {
              x: scenePoint.x - event.target.x(),
              y: scenePoint.y - event.target.y(),
            };
          } else dragOffsetRef.current = null;
        }}
        onDragMove={(event) => {
          const stage = event.target.getStage();
          const parent = event.target.getParent();
          const pointerPosition = stage?.getPointerPosition();
          let next = { x: event.target.x(), y: event.target.y() };
          if (parent && pointerPosition && dragOffsetRef.current) {
            const scenePoint = parent.getAbsoluteTransform().copy().invert().point(pointerPosition);
            next = {
              x: scenePoint.x - dragOffsetRef.current.x,
              y: scenePoint.y - dragOffsetRef.current.y,
            };
          }
          if (snapEnabled) {
            const snapped = snapPoint(next, room.scene, {
              gridSize,
              tolerance: snapTolerance,
              excludeId: object.id,
            });
            next = { x: snapped.x, y: snapped.y };
            setGuides(snapped.guides);
          }
          event.target.position(next);
          let position = { ...(beforeRef.current?.position ?? object.position), ...next };
          if (requiresBenchSupport(object)) {
            const candidate = { ...object, position };
            const support = findBenchSupport(room, candidate);
            if (support) position = { ...position, z: support.elevationMm };
          }
          previewObject(object.id, { position });
        }}
        onDragEnd={() => {
          if (beforeRef.current) {
            if (requiresBenchSupport(object)) {
              const currentState = useEditorStore.getState();
              const currentRoom = currentState.project.rooms.find(
                (entry) => entry.id === currentState.project.activeRoomId,
              );
              const currentObject = currentRoom?.scene.objects.find(
                (entry) => entry.id === object.id,
              );
              const supported =
                currentRoom && currentObject
                  ? snapBenchObjectToAvailableSupport(currentRoom, currentObject)
                  : null;
              if (supported) {
                previewObject(object.id, { position: supported.position });
                if (
                  supported.position.x !== currentObject?.position.x ||
                  supported.position.y !== currentObject?.position.y
                ) {
                  pushToast(`${object.name} snapped to the nearest clear bench surface.`, "info");
                }
              } else {
                previewObject(object.id, { position: beforeRef.current.position });
                pushToast(`${object.name} must stay on a clear bench or table surface.`, "error");
              }
            }
            commitPreview(beforeRef.current, `Move ${object.name}`);
          }
          beforeRef.current = null;
          dragOffsetRef.current = null;
          setGuides([]);
        }}
        onTransformStart={() => {
          beforeRef.current = structuredClone(object);
        }}
        onTransformEnd={(event) => {
          const node = event.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          updateObject(
            object.id,
            {
              position: { ...object.position, x: node.x(), y: node.y() },
              dimensions: {
                ...object.dimensions,
                width: Math.max(100, width * Math.abs(scaleX)),
                depth: Math.max(100, depth * Math.abs(scaleY)),
              },
              rotation: { ...object.rotation, z: node.rotation() },
            },
            `Resize ${object.name}`,
          );
          beforeRef.current = null;
        }}
      >
        {agentPlanPreview && (
          <Rect
            x={-width / 2 - 8 / scale}
            y={-depth / 2 - 8 / scale}
            width={width + 16 / scale}
            height={depth + 16 / scale}
            cornerRadius={7 / scale}
            fill="rgba(0, 198, 178, 0.08)"
            stroke="#00a995"
            strokeWidth={1.5 / scale}
            dash={[7 / scale, 5 / scale]}
            listening={false}
          />
        )}
        {profile === "round" || profile === "cylinder" || profile === "seat" ? (
          <Circle
            name="scene-object-hit-area"
            radius={Math.min(width, depth) / 2}
            fill="rgba(255,255,255,0.001)"
          />
        ) : (
          <Rect
            name="scene-object-hit-area"
            x={-width / 2}
            y={-depth / 2}
            width={width}
            height={depth}
            cornerRadius={profile === "box" ? 35 : 10}
            fill="rgba(255,255,255,0.001)"
          />
        )}
        <Group
          scaleX={object.flipHorizontal ? -1 : 1}
          scaleY={object.flipVertical ? -1 : 1}
          listening={false}
        >
          {planImage ? (
            <>
              {(selected || hovered) &&
                (profile === "round" || profile === "cylinder" || profile === "seat" ? (
                  <Circle
                    radius={Math.min(width, depth) / 2}
                    fill={selected ? "rgba(7,153,135,0.075)" : "rgba(7,153,135,0.035)"}
                    shadowColor="#20302e"
                    shadowOpacity={selected ? 0.16 : 0.08}
                    shadowBlur={(selected ? 7 : 4) / scale}
                    shadowOffset={{ x: 0, y: 2 / scale }}
                  />
                ) : (
                  <Rect
                    x={-width / 2}
                    y={-depth / 2}
                    width={width}
                    height={depth}
                    cornerRadius={profile === "box" ? 20 : 6}
                    fill={selected ? "rgba(7,153,135,0.06)" : "rgba(7,153,135,0.028)"}
                    shadowColor="#20302e"
                    shadowOpacity={selected ? 0.16 : 0.08}
                    shadowBlur={(selected ? 7 : 4) / scale}
                    shadowOffset={{ x: 0, y: 2 / scale }}
                  />
                ))}
              <KonvaImage
                image={planImage}
                x={-width / 2}
                y={-depth / 2}
                width={width}
                height={depth}
                listening={false}
                perfectDrawEnabled={false}
                opacity={locked ? 0.52 : 1}
                shadowColor="#172321"
                shadowOpacity={selected ? 0.18 : 0.1}
                shadowBlur={(selected ? 4 : 2) / scale}
                shadowOffset={{ x: 0, y: 1.5 / scale }}
              />
              {(selected || hovered) &&
                (profile === "round" || profile === "cylinder" || profile === "seat" ? (
                  <Circle
                    radius={Math.min(width, depth) / 2}
                    fill="rgba(255,255,255,0.001)"
                    stroke={selected ? "#079987" : "rgba(7,153,135,0.62)"}
                    strokeWidth={(selected ? 1.8 : 1) / scale}
                  />
                ) : (
                  <Rect
                    x={-width / 2}
                    y={-depth / 2}
                    width={width}
                    height={depth}
                    cornerRadius={profile === "box" ? 20 : 6}
                    fill="rgba(255,255,255,0.001)"
                    stroke={selected ? "#079987" : "rgba(7,153,135,0.62)"}
                    strokeWidth={(selected ? 1.8 : 1) / scale}
                  />
                ))}
            </>
          ) : planImageStatus === "loading" ? (
            profile === "round" || profile === "cylinder" || profile === "seat" ? (
              <Circle
                radius={Math.min(width, depth) / 2}
                fill="#eef2f0"
                stroke="#c7d1ce"
                strokeWidth={0.8 / scale}
                dash={[5 / scale, 4 / scale]}
                listening={false}
              />
            ) : (
              <Rect
                x={-width / 2}
                y={-depth / 2}
                width={width}
                height={depth}
                cornerRadius={profile === "box" ? 20 : 6}
                fill="#eef2f0"
                stroke="#c7d1ce"
                strokeWidth={0.8 / scale}
                dash={[5 / scale, 4 / scale]}
                listening={false}
              />
            )
          ) : profile === "round" || profile === "cylinder" || profile === "seat" ? (
            <>
              <Circle
                radius={Math.min(width, depth) / 2}
                fill={palette.fill}
                stroke={selected ? "#079987" : palette.stroke}
                strokeWidth={(selected ? 2 : 0.8) / scale}
              />
              <Circle
                radius={Math.min(width, depth) * 0.24}
                fill={definition.accent}
                opacity={0.8}
              />
            </>
          ) : profile === "corner" ? (
            <Line
              points={[
                -width / 2,
                -depth / 2,
                width / 2,
                -depth / 2,
                width / 2,
                -depth / 6,
                -width / 6,
                -depth / 6,
                -width / 6,
                depth / 2,
                -width / 2,
                depth / 2,
              ]}
              closed
              fill={palette.fill}
              stroke={selected ? "#079987" : palette.stroke}
              strokeWidth={(selected ? 2 : 0.8) / scale}
            />
          ) : (
            <>
              <Rect
                x={-width / 2}
                y={-depth / 2}
                width={width}
                height={depth}
                cornerRadius={profile === "box" ? 35 : 10}
                fill={palette.fill}
                stroke={selected ? "#079987" : palette.stroke}
                strokeWidth={(selected ? 2 : 0.8) / scale}
                shadowColor="#182325"
                shadowOpacity={0.12}
                shadowBlur={(selected ? 5 : 3) / scale}
                shadowOffset={{ x: 0, y: 3 / scale }}
              />
              {profile === "bench" || profile === "table" || profile === "workstation" ? (
                <>
                  <Line
                    points={[-width / 2 + 80, -depth / 2 + 90, width / 2 - 80, -depth / 2 + 90]}
                    stroke={palette.accent}
                    strokeWidth={1 / scale}
                    opacity={0.7}
                  />
                  {object.assetDefinitionId.includes("sink") && (
                    <Rect
                      x={-width * 0.28}
                      y={-depth * 0.27}
                      width={width * 0.25}
                      height={depth * 0.54}
                      cornerRadius={24}
                      fill="#afc5c5"
                      stroke="#526666"
                      strokeWidth={0.8 / scale}
                    />
                  )}
                </>
              ) : null}
              {profile === "cabinet" || profile === "tall" || profile === "locker" ? (
                <>
                  <Line
                    points={[0, -depth / 2 + 30, 0, depth / 2 - 30]}
                    stroke={palette.stroke}
                    strokeWidth={0.8 / scale}
                    opacity={0.6}
                  />
                  <Circle x={-width * 0.05} radius={1.5 / scale} fill={definition.accent} />
                  <Circle x={width * 0.05} radius={1.5 / scale} fill={definition.accent} />
                </>
              ) : null}
              {profile === "hood" && (
                <Rect
                  x={-width * 0.35}
                  y={-depth * 0.22}
                  width={width * 0.7}
                  height={depth * 0.44}
                  fill="#c4dadd"
                  stroke="#567a7e"
                  strokeWidth={0.8 / scale}
                />
              )}
              {profile === "scope" && (
                <Arc
                  x={0}
                  y={depth * 0.08}
                  innerRadius={Math.min(width, depth) * 0.18}
                  outerRadius={Math.min(width, depth) * 0.28}
                  angle={250}
                  rotation={-80}
                  fill={palette.stroke}
                />
              )}
              {!["bench", "table", "cabinet", "tall", "locker", "hood", "scope"].includes(
                profile,
              ) && (
                <Rect
                  x={width * 0.05}
                  y={-depth * 0.18}
                  width={width * 0.3}
                  height={depth * 0.36}
                  cornerRadius={15}
                  fill={definition.accent}
                  opacity={0.9}
                />
              )}
            </>
          )}
        </Group>
      </Group>
    </>
  );
}

function WallPlan({
  object,
  selected,
  scale,
}: {
  object: SceneObject;
  selected: boolean;
  scale: number;
}) {
  const room = useEditorStore(selectActiveRoom);
  const setSelected = useEditorStore((state) => state.setSelected);
  const setHovered = useEditorStore((state) => state.setHovered);
  const setGuides = useEditorStore((state) => state.setGuides);
  const previewObjects = useEditorStore((state) => state.previewObjects);
  const commitPreviewBatch = useEditorStore((state) => state.commitPreviewBatch);
  const tool = useEditorStore((state) => state.tool);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridSize = useEditorStore((state) => state.gridSize);
  const snapTolerance = useEditorStore((state) => state.snapTolerance);
  const beforeObjectsRef = useRef<SceneObject[] | null>(null);
  if (!object.wall) return null;
  const layer = room.scene.layers.find((entry) => entry.id === object.layerId);
  const locked = object.locked || layer?.locked;
  const wallFinish = wallFinishForObject(object.metadata, room.wallFinish);

  const selectWall = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== "select") return;
    event.cancelBubble = true;
    setSelected([object.id], "shiftKey" in event.evt && event.evt.shiftKey);
  };

  const beginWallEdit = () => {
    beforeObjectsRef.current = structuredClone(room.scene.objects);
    if (!selected) setSelected([object.id]);
  };

  const finishEndpointEdit = (endpoint: WallEndpoint, event: KonvaEventObject<DragEvent>) => {
    const before = beforeObjectsRef.current;
    beforeObjectsRef.current = null;
    if (!before) return;
    const beforeWall = before.find((entry) => entry.id === object.id)?.wall;
    if (!beforeWall) return;
    let nextPoint = { x: event.target.x(), y: event.target.y() };
    event.target.position(beforeWall[endpoint]);
    if (snapEnabled) {
      const snapped = snapPoint(
        nextPoint,
        { ...room.scene, objects: before },
        { gridSize, tolerance: snapTolerance, excludeId: object.id },
      );
      nextPoint = { x: snapped.x, y: snapped.y };
    }
    const next = editWallEndpoint(
      before,
      object.id,
      endpoint,
      nextPoint,
      Math.max(35, snapTolerance),
    );
    if (next === before) {
      setGuides([]);
      return;
    }
    const synchronized = synchronizeClosedRoomAfterWallEdit(before, next);
    previewObjects(
      synchronized?.objects ?? next,
      synchronized ? { width: synchronized.width, depth: synchronized.depth } : undefined,
    );
    commitPreviewBatch(before, `Move ${object.name} ${endpoint} point`, {
      width: room.width,
      depth: room.depth,
    });
    setGuides([]);
  };

  return (
    <>
      <Line
        name="editable-wall"
        points={[object.wall.start.x, object.wall.start.y, object.wall.end.x, object.wall.end.y]}
        stroke={selected ? "#079987" : wallFinish.planEdgeColor}
        strokeWidth={object.wall.thickness}
        lineCap="square"
        lineJoin="miter"
        hitStrokeWidth={Math.max(object.wall.thickness, 20 / scale)}
        draggable={tool === "select" && !locked}
        onClick={selectWall}
        onTap={selectWall}
        onDragStart={(event) => {
          event.cancelBubble = true;
          beginWallEdit();
        }}
        onDragEnd={(event) => {
          const before = beforeObjectsRef.current;
          beforeObjectsRef.current = null;
          if (!before) return;
          const beforeWall = before.find((entry) => entry.id === object.id)?.wall;
          if (!beforeWall) return;
          const rawDelta = { x: event.target.x(), y: event.target.y() };
          event.target.position({ x: 0, y: 0 });
          const delta = snapEnabled
            ? {
                x:
                  snapValue(beforeWall.start.x + rawDelta.x, gridSize, snapTolerance) -
                  beforeWall.start.x,
                y:
                  snapValue(beforeWall.start.y + rawDelta.y, gridSize, snapTolerance) -
                  beforeWall.start.y,
              }
            : rawDelta;
          const next = translateWall(before, object.id, delta, Math.max(35, snapTolerance));
          if (next === before) {
            setGuides([]);
            return;
          }
          const synchronized = synchronizeClosedRoomAfterWallEdit(before, next);
          previewObjects(
            synchronized?.objects ?? next,
            synchronized ? { width: synchronized.width, depth: synchronized.depth } : undefined,
          );
          commitPreviewBatch(before, `Move ${object.name}`, {
            width: room.width,
            depth: room.depth,
          });
          setGuides([]);
        }}
        onMouseEnter={() => setHovered(object.id)}
        onMouseLeave={() => setHovered(null)}
      />
      <Line
        points={[object.wall.start.x, object.wall.start.y, object.wall.end.x, object.wall.end.y]}
        stroke={selected ? "#c5f0ea" : wallFinish.planColor}
        strokeWidth={Math.max(object.wall.thickness - 4 / scale, object.wall.thickness * 0.7)}
        lineCap="square"
        lineJoin="miter"
        listening={false}
      />
      {selected && tool === "select" && !locked && (
        <>
          {(["start", "end"] as const).map((endpoint) => (
            <Circle
              key={endpoint}
              name={`wall-${endpoint}-handle`}
              x={object.wall![endpoint].x}
              y={object.wall![endpoint].y}
              radius={7 / scale}
              fill="#ffffff"
              stroke="#079987"
              strokeWidth={2 / scale}
              hitStrokeWidth={18 / scale}
              draggable
              onDragStart={(event) => {
                event.cancelBubble = true;
                beginWallEdit();
              }}
              onDragMove={(event) => {
                if (!snapEnabled || !beforeObjectsRef.current) return;
                const snapped = snapPoint(
                  { x: event.target.x(), y: event.target.y() },
                  { ...room.scene, objects: beforeObjectsRef.current },
                  { gridSize, tolerance: snapTolerance, excludeId: object.id },
                );
                event.target.position({ x: snapped.x, y: snapped.y });
                setGuides(snapped.guides);
              }}
              onDragEnd={(event) => finishEndpointEdit(endpoint, event)}
            />
          ))}
        </>
      )}
    </>
  );
}

function OpeningPlan({
  object,
  selected,
  scale,
}: {
  object: SceneObject;
  selected: boolean;
  scale: number;
}) {
  const room = useEditorStore(selectActiveRoom);
  const setSelected = useEditorStore((state) => state.setSelected);
  const setHovered = useEditorStore((state) => state.setHovered);
  const previewObject = useEditorStore((state) => state.previewObject);
  const commitPreview = useEditorStore((state) => state.commitPreview);
  const tool = useEditorStore((state) => state.tool);
  const beforeRef = useRef<SceneObject | null>(null);
  const resolved = resolveHostedOpening(object, room.scene.objects);
  const width = object.dimensions.width;
  const isDoor = object.objectType === "door";
  const isSlidingDoor = isDoor && object.opening?.swing === "sliding";
  const isDoubleDoor =
    object.assetDefinitionId === "double-door" ||
    object.assetDefinitionId === "double-sliding-door";
  const windowPaneCount =
    object.assetDefinitionId === "wide-window"
      ? 3
      : ["sliding-window", "observation-window", "pass-through-window"].includes(
            object.assetDefinitionId,
          )
        ? 2
        : 1;
  const layer = room.scene.layers.find((entry) => entry.id === object.layerId);
  const locked = object.locked || layer?.locked;
  const x = resolved?.point.x ?? object.position.x;
  const y = resolved?.point.y ?? object.position.y;
  const rotation = resolved?.rotation ?? object.rotation.z;
  const flipHorizontal = isDoor ? object.opening?.handing === "right" : object.flipHorizontal;
  const flipVertical = isDoor ? object.opening?.swing === "outward" : object.flipVertical;
  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      draggable={tool === "select" && !locked}
      onClick={(event) => {
        if (tool !== "select") return;
        event.cancelBubble = true;
        setSelected([object.id]);
      }}
      onMouseEnter={() => setHovered(object.id)}
      onMouseLeave={() => setHovered(null)}
      onDragStart={() => {
        beforeRef.current = structuredClone(object);
      }}
      onDragMove={(event) => {
        const stage = event.target.getStage();
        const pointerPosition = stage?.getPointerPosition();
        const parent = event.target.getParent();
        if (!pointerPosition || !parent) return;
        const scenePoint = parent.getAbsoluteTransform().copy().invert().point(pointerPosition);
        const projection = findNearestWallProjection(
          room.scene.objects,
          scenePoint,
          object.dimensions.width,
          600,
        );
        if (
          !projection ||
          openingOverlapsSibling(
            room.scene.objects,
            projection.wall.id,
            projection.offset,
            object.dimensions.width,
            object.id,
          )
        ) {
          event.target.position({ x, y });
          event.target.rotation(rotation);
          return;
        }
        const patch = hostOpeningAtPoint(object, projection);
        event.target.position({ x: patch.position.x, y: patch.position.y });
        event.target.rotation(patch.rotation.z);
        previewObject(object.id, patch);
      }}
      onDragEnd={() => {
        if (beforeRef.current) commitPreview(beforeRef.current, `Move ${object.name} along wall`);
        beforeRef.current = null;
      }}
    >
      <Line
        points={[-width / 2, 0, width / 2, 0]}
        stroke="#fbfcfc"
        strokeWidth={(resolved?.wall.wall?.thickness ?? 150) + 4 / scale}
      />
      <Group scaleX={flipHorizontal ? -1 : 1} scaleY={flipVertical ? -1 : 1}>
        <Line
          points={[-width / 2, 0, width / 2, 0]}
          stroke={selected ? "#079987" : isDoor ? "#4d5a5c" : "#5797a1"}
          strokeWidth={(isDoor ? 1.5 : 6) / scale}
        />
        {isDoor &&
          !isSlidingDoor &&
          (isDoubleDoor ? (
            <>
              <Line
                points={[-width / 2, 0, -width / 2, width / 2]}
                stroke="#4d5a5c"
                strokeWidth={1.2 / scale}
              />
              <Arc
                x={-width / 2}
                innerRadius={width / 2}
                outerRadius={width / 2}
                angle={90}
                stroke="#879291"
                strokeWidth={0.8 / scale}
              />
              <Line
                points={[width / 2, 0, width / 2, width / 2]}
                stroke="#4d5a5c"
                strokeWidth={1.2 / scale}
              />
              <Arc
                x={width / 2}
                rotation={90}
                innerRadius={width / 2}
                outerRadius={width / 2}
                angle={90}
                stroke="#879291"
                strokeWidth={0.8 / scale}
              />
            </>
          ) : (
            <>
              <Line
                points={[-width / 2, 0, -width / 2, width]}
                stroke="#4d5a5c"
                strokeWidth={1.2 / scale}
              />
              <Arc
                x={-width / 2}
                innerRadius={width}
                outerRadius={width}
                angle={90}
                stroke="#879291"
                strokeWidth={0.8 / scale}
              />
            </>
          ))}
        {isSlidingDoor && (
          <>
            <Line
              points={[-width / 2, -3 / scale, width / 2, -3 / scale]}
              stroke="#718083"
              strokeWidth={1.2 / scale}
            />
            <Line
              points={[-width / 2, 3 / scale, width / 2, 3 / scale]}
              stroke="#718083"
              strokeWidth={1.2 / scale}
            />
            <Line points={[0, -5 / scale, 0, 5 / scale]} stroke="#4d5a5c" strokeWidth={1 / scale} />
          </>
        )}
        {!isDoor && (
          <>
            <Line
              points={[-width / 2, -2 / scale, width / 2, -2 / scale]}
              stroke="#86b8bd"
              strokeWidth={1 / scale}
            />
            <Line
              points={[-width / 2, 2 / scale, width / 2, 2 / scale]}
              stroke="#b6d6d8"
              strokeWidth={1 / scale}
            />
            {Array.from({ length: windowPaneCount - 1 }, (_, index) => {
              const divider = -width / 2 + (width * (index + 1)) / windowPaneCount;
              return (
                <Line
                  key={`pane-divider-${index}`}
                  points={[divider, -5 / scale, divider, 5 / scale]}
                  stroke="#5797a1"
                  strokeWidth={1 / scale}
                />
              );
            })}
          </>
        )}
      </Group>
    </Group>
  );
}

export function TwoDEditor() {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Group>());
  const room = useEditorStore(selectActiveRoom);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const tool = useEditorStore((state) => state.tool);
  const zoom = useEditorStore((state) => state.zoom);
  const pan = useEditorStore((state) => state.pan);
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridSize = useEditorStore((state) => state.gridSize);
  const snapTolerance = useEditorStore((state) => state.snapTolerance);
  const measurementOverlays = useEditorStore((state) => state.measurementOverlays);
  const guides = useEditorStore((state) => state.guides);
  const setSelected = useEditorStore((state) => state.setSelected);
  const setCursor = useEditorStore((state) => state.setCursor);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setPan = useEditorStore((state) => state.setPan);
  const addAsset = useEditorStore((state) => state.addAsset);
  const addWall = useEditorStore((state) => state.addWall);
  const setTool = useEditorStore((state) => state.setTool);
  const setGuides = useEditorStore((state) => state.setGuides);
  const [spacePan, setSpacePan] = useState(false);
  const middlePanRef = useRef<{
    pointer: { x: number; y: number };
    pan: { x: number; y: number };
  } | null>(null);
  const [drawStart, setDrawStart] = useState<WallPoint | null>(null);
  const drawStartRef = useRef<WallPoint | null>(null);
  const lastWallClickRef = useRef<WallPoint | null>(null);
  const wallDoubleClickEligibleRef = useRef(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [measure, setMeasure] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);
  const floorPlan = useMemo(() => getRoomFloorPlan(room), [room]);
  const closedFloor = useMemo(
    () => getClosedWallFloorPolygon(room.scene.objects),
    [room.scene.objects],
  );
  const padding = 54;
  const baseScale = Math.min(
    (size.width - padding * 2) / floorPlan.bounds.width,
    (size.height - padding * 2) / floorPlan.bounds.depth,
  );
  const scale = Math.max(0.015, baseScale * zoom);
  const origin = {
    x: (size.width - floorPlan.bounds.width * scale) / 2 - floorPlan.bounds.minX * scale + pan.x,
    y: (size.height - floorPlan.bounds.depth * scale) / 2 - floorPlan.bounds.minY * scale + pan.y,
  };

  const layerVisibility = useMemo(
    () => new Map(room.scene.layers.map((layer) => [layer.id, layer.visible])),
    [room.scene.layers],
  );
  const visibleObjects = room.scene.objects.filter(
    (object) => object.visible && layerVisibility.get(object.layerId) !== false,
  );
  const placementWarnings = useMemo(
    () =>
      validatePlacement(room).filter((warning) =>
        ["outside-", "below-floor-", "above-ceiling-", "overlap-"].some((prefix) =>
          warning.id.startsWith(prefix),
        ),
      ),
    [room],
  );
  const placementByObjectId = useMemo(() => {
    const priority = { info: 0, warning: 1, error: 2 } as const;
    const result = new Map<string, "info" | "warning" | "error">();
    for (const warning of placementWarnings) {
      for (const objectId of warning.objectIds) {
        const existing = result.get(objectId);
        if (!existing || priority[warning.severity] > priority[existing]) {
          result.set(objectId, warning.severity);
        }
      }
    }
    return result;
  }, [placementWarnings]);
  const selectedPlacementWarnings = useMemo(
    () =>
      placementWarnings.filter((warning) =>
        warning.objectIds.some((objectId) => selectedIds.includes(objectId)),
      ),
    [placementWarnings, selectedIds],
  );
  const selectedPlacementTone = selectedPlacementWarnings.some(
    (warning) => warning.severity === "error",
  )
    ? "error"
    : selectedPlacementWarnings.some((warning) => warning.severity === "warning")
      ? "warning"
      : "clear";
  const selectedSceneObject =
    selectedIds.length === 1
      ? room.scene.objects.find((object) => object.id === selectedIds[0])
      : undefined;
  const selectedObjectDefinition = selectedSceneObject
    ? getAssetDefinition(selectedSceneObject.assetDefinitionId)
    : undefined;
  const selectedObjectSupportsPlacementStatus =
    selectedIds.length > 1 ||
    (selectedSceneObject !== undefined &&
      !["wall", "door", "window"].includes(selectedSceneObject.objectType));
  const selectedPlacementTitle =
    selectedIds.length > 1
      ? `${selectedIds.length} items selected`
      : (selectedObjectDefinition?.shortName ?? selectedSceneObject?.name ?? "Selected item");
  const openingPreview = useMemo(() => {
    if (!pointer || (tool !== "door" && tool !== "window")) return null;
    const definition = getAssetDefinition(tool === "door" ? "single-door" : "standard-window");
    const projection = findNearestWallProjection(
      room.scene.objects,
      pointer,
      definition.defaultDimensions.width,
      600,
    );
    if (!projection) return null;
    return {
      ...projection,
      width: definition.defaultDimensions.width,
      invalid: openingOverlapsSibling(
        room.scene.objects,
        projection.wall.id,
        projection.offset,
        definition.defaultDimensions.width,
      ),
    };
  }, [pointer, room.scene.objects, tool]);

  useEffect(() => {
    const previousDragButtons = [...Konva.dragButtons];
    // Middle-button motion is reserved for viewport navigation. Without this,
    // Konva also starts dragging whichever editable object is below the cursor.
    Konva.dragButtons = [0];
    return () => {
      Konva.dragButtons = previousDragButtons;
    };
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePan(true);
      }
      if (tool === "select" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const key = event.key.toLowerCase();
        const step = event.shiftKey ? 140 : 56;
        const movement =
          key === "arrowleft" || key === "a"
            ? { x: -step, y: 0 }
            : key === "arrowright" || key === "d"
              ? { x: step, y: 0 }
              : key === "arrowup" || key === "w"
                ? { x: 0, y: -step }
                : key === "arrowdown" || key === "s"
                  ? { x: 0, y: step }
                  : null;
        if (movement) {
          event.preventDefault();
          const currentPan = useEditorStore.getState().pan;
          setPan({ x: currentPan.x + movement.x, y: currentPan.y + movement.y });
          return;
        }
      }
      if (event.key === "Enter" && tool === "wall" && !isEditableTarget(event.target)) {
        event.preventDefault();
        drawStartRef.current = null;
        lastWallClickRef.current = null;
        wallDoubleClickEligibleRef.current = false;
        setDrawStart(null);
        setGuides([]);
        return;
      }
      if (event.key === "Escape") {
        drawStartRef.current = null;
        lastWallClickRef.current = null;
        wallDoubleClickEligibleRef.current = false;
        setDrawStart(null);
        setMeasure(null);
        setMarquee(null);
        setGuides([]);
        setTool("select");
      }
    };
    const keyUp = (event: KeyboardEvent) => event.code === "Space" && setSpacePan(false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [setGuides, setPan, setTool, tool]);

  useEffect(() => {
    const stopMiddlePan = () => {
      middlePanRef.current = null;
    };
    window.addEventListener("mouseup", stopMiddlePan);
    return () => window.removeEventListener("mouseup", stopMiddlePan);
  }, []);

  useEffect(
    () =>
      useEditorStore.subscribe((state, previousState) => {
        if (state.tool === previousState.tool) return;
        drawStartRef.current = null;
        lastWallClickRef.current = null;
        wallDoubleClickEligibleRef.current = false;
        setDrawStart(null);
      }),
    [],
  );

  useEffect(() => {
    const selectedNode =
      selectedIds.length === 1 ? nodeRefs.current.get(selectedIds[0]) : undefined;
    transformerRef.current?.nodes(selectedNode ? [selectedNode] : []);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [selectedIds, room.scene.objects]);

  const pointerToScene = () => {
    const point = stageRef.current?.getPointerPosition();
    if (!point) return { x: 0, y: 0 };
    return { x: (point.x - origin.x) / scale, y: (point.y - origin.y) / scale };
  };

  const pointerToWallPoint = () => {
    const point = pointerToScene();
    if (!snapEnabled) {
      setGuides([]);
      return point;
    }
    const snapped = snapPoint(point, room.scene, {
      gridSize,
      tolerance: snapTolerance,
    });
    setGuides(snapped.guides);
    return { x: snapped.x, y: snapped.y };
  };

  const finishWallChain = () => {
    drawStartRef.current = null;
    lastWallClickRef.current = null;
    wallDoubleClickEligibleRef.current = false;
    setDrawStart(null);
    setGuides([]);
  };

  const handleWallDoubleClick = () => {
    if (tool === "wall" && wallDoubleClickEligibleRef.current) finishWallChain();
  };

  const handleStageDown = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if ("button" in event.evt && event.evt.button === 1 && tool === "select") {
      event.evt.preventDefault();
      event.cancelBubble = true;
      const pointerPosition = stageRef.current?.getPointerPosition();
      if (pointerPosition) {
        middlePanRef.current = {
          pointer: pointerPosition,
          pan: { ...pan },
        };
        setMarquee(null);
      }
      return;
    }
    if (spacePan) return;
    if (
      event.target !== event.target.getStage() &&
      tool !== "wall" &&
      tool !== "door" &&
      tool !== "window"
    )
      return;
    const point = tool === "wall" ? pointerToWallPoint() : pointerToScene();
    if (tool === "wall") {
      const previousClick = lastWallClickRef.current;
      wallDoubleClickEligibleRef.current = Boolean(
        previousClick &&
          Math.hypot(point.x - previousClick.x, point.y - previousClick.y) <=
            Math.max(40, snapTolerance),
      );
      lastWallClickRef.current = point;
      const { nextStart, segment } = advanceWallChain(drawStartRef.current, point);
      if (segment) addWall(segment.start, segment.end);
      drawStartRef.current = nextStart;
      setDrawStart(nextStart);
      return;
    }
    if (tool === "door" || tool === "window") {
      const id = addAsset(tool === "door" ? "single-door" : "standard-window", point);
      if (id) setTool("select");
      return;
    }
    if (tool === "measure") {
      if (!measure) setMeasure({ start: point, end: point });
      else setMeasure({ ...measure, end: point });
      return;
    }
    if (tool === "select") {
      setSelected([]);
      setMarquee({ start: point, end: point });
    }
  };

  const handleMove = () => {
    if (middlePanRef.current) {
      const pointerPosition = stageRef.current?.getPointerPosition();
      if (pointerPosition) {
        setPan({
          x: middlePanRef.current.pan.x + pointerPosition.x - middlePanRef.current.pointer.x,
          y: middlePanRef.current.pan.y + pointerPosition.y - middlePanRef.current.pointer.y,
        });
      }
      return;
    }
    const point = tool === "wall" && !spacePan ? pointerToWallPoint() : pointerToScene();
    setPointer(point);
    setCursor({ x: Math.round(point.x), y: Math.round(point.y) });
    if (measure && tool === "measure") setMeasure({ ...measure, end: point });
    if (marquee) setMarquee({ ...marquee, end: point });
  };

  const handleStageUp = () => {
    if (middlePanRef.current) {
      middlePanRef.current = null;
      return;
    }
    if (!marquee) return;
    const left = Math.min(marquee.start.x, marquee.end.x);
    const right = Math.max(marquee.start.x, marquee.end.x);
    const top = Math.min(marquee.start.y, marquee.end.y);
    const bottom = Math.max(marquee.start.y, marquee.end.y);
    if (Math.abs(right - left) > 30 && Math.abs(bottom - top) > 30) {
      const ids = visibleObjects
        .filter((object) => {
          const bounds = objectBounds(object);
          return (
            bounds.left >= left &&
            bounds.right <= right &&
            bounds.top >= top &&
            bounds.bottom <= bottom
          );
        })
        .map((object) => object.id);
      setSelected(ids);
    }
    setMarquee(null);
  };

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointerPosition = stage?.getPointerPosition();
    if (!pointerPosition) return;
    const scenePoint = {
      x: (pointerPosition.x - origin.x) / scale,
      y: (pointerPosition.y - origin.y) / scale,
    };
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.min(3.2, Math.max(0.35, zoom * (direction > 0 ? 1.1 : 0.9)));
    const nextScale = baseScale * nextZoom;
    setZoom(nextZoom);
    setPan({
      x:
        pointerPosition.x -
        ((size.width - floorPlan.bounds.width * nextScale) / 2 -
          floorPlan.bounds.minX * nextScale) -
        scenePoint.x * nextScale,
      y:
        pointerPosition.y -
        ((size.height - floorPlan.bounds.depth * nextScale) / 2 -
          floorPlan.bounds.minY * nextScale) -
        scenePoint.y * nextScale,
    });
  };

  const gridLines = [];
  if (gridEnabled) {
    const gridStartX = Math.ceil(floorPlan.bounds.minX / gridSize) * gridSize;
    const gridStartY = Math.ceil(floorPlan.bounds.minY / gridSize) * gridSize;
    for (let x = gridStartX; x <= floorPlan.bounds.maxX; x += gridSize)
      gridLines.push(
        <Line
          key={`gx-${x}`}
          points={[x, floorPlan.bounds.minY, x, floorPlan.bounds.maxY]}
          stroke={x % 1000 === 0 ? "#d4dcda" : "#e8edec"}
          strokeWidth={(x % 1000 === 0 ? 1.2 : 0.6) / scale}
          listening={false}
        />,
      );
    for (let y = gridStartY; y <= floorPlan.bounds.maxY; y += gridSize)
      gridLines.push(
        <Line
          key={`gy-${y}`}
          points={[floorPlan.bounds.minX, y, floorPlan.bounds.maxX, y]}
          stroke={y % 1000 === 0 ? "#d4dcda" : "#e8edec"}
          strokeWidth={(y % 1000 === 0 ? 1.2 : 0.6) / scale}
          listening={false}
        />,
      );
  }

  const coordinateLabel = pointer
    ? `X ${(pointer.x / 1000).toFixed(2)} m  ·  Y ${(pointer.y / 1000).toFixed(2)} m`
    : "X —  ·  Y —";

  return (
    <div
      className={`two-d-editor tool-${tool}`}
      ref={containerRef}
      data-testid="2d-editor"
      data-plan-scale={scale}
      data-plan-origin-x={origin.x}
      data-plan-origin-y={origin.y}
      data-floor-state={closedFloor ? "wall-derived" : "awaiting-closed-walls"}
      data-wall-chain-start-x={drawStart?.x ?? undefined}
      data-wall-chain-start-y={drawStart?.y ?? undefined}
      data-automatic-measurements={Object.entries(measurementOverlays)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
        .join(",")}
      onDragOver={(event) => event.preventDefault()}
      onAuxClick={(event) => event.button === 1 && event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const assetId = event.dataTransfer.getData("application/labspace-asset");
        if (!assetId) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        addAsset(assetId, {
          x: (event.clientX - bounds.left - origin.x) / scale,
          y: (event.clientY - bounds.top - origin.y) / scale,
        });
      }}
    >
      <Stage
        ref={stageRef}
        width={Math.max(2, size.width)}
        height={Math.max(2, size.height)}
        draggable={tool === "pan" || spacePan}
        onDragEnd={(event) => {
          if (event.target !== event.target.getStage()) return;
          setPan({ x: pan.x + event.target.x(), y: pan.y + event.target.y() });
          event.target.position({ x: 0, y: 0 });
        }}
        onMouseDown={handleStageDown}
        onTouchStart={handleStageDown}
        onMouseMove={handleMove}
        onTouchMove={handleMove}
        onMouseUp={handleStageUp}
        onTouchEnd={handleStageUp}
        onDblClick={handleWallDoubleClick}
        onDblTap={handleWallDoubleClick}
        onWheel={handleWheel}
      >
        <Layer>
          <Group x={origin.x} y={origin.y} scaleX={scale} scaleY={scale}>
            <RoomFloorPlanShape room={room} scale={scale}>
              {closedFloor ? gridLines : null}
            </RoomFloorPlanShape>
            {visibleObjects
              .filter((object) => object.objectType === "wall")
              .map((object) => (
                <WallPlan
                  key={object.id}
                  object={object}
                  selected={selectedIds.includes(object.id)}
                  scale={scale}
                />
              ))}
            {openingPreview && (
              <Group
                x={openingPreview.point.x}
                y={openingPreview.point.y}
                rotation={openingPreview.rotation}
                listening={false}
                opacity={0.92}
              >
                <Line
                  points={[-openingPreview.width / 2, 0, openingPreview.width / 2, 0]}
                  stroke={openingPreview.invalid ? "#c54b43" : "#079987"}
                  strokeWidth={5 / scale}
                  dash={[10 / scale, 6 / scale]}
                />
                <Circle radius={7 / scale} fill={openingPreview.invalid ? "#c54b43" : "#079987"} />
              </Group>
            )}
            {visibleObjects
              .filter((object) => object.objectType === "door" || object.objectType === "window")
              .map((object) => (
                <OpeningPlan
                  key={object.id}
                  object={object}
                  selected={selectedIds.includes(object.id)}
                  scale={scale}
                />
              ))}
            {visibleObjects
              .filter((object) => !["wall", "door", "window"].includes(object.objectType))
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((object) => (
                <PlanObject
                  key={object.id}
                  object={object}
                  selected={selectedIds.includes(object.id)}
                  scale={scale}
                  register={(id, node) =>
                    node ? nodeRefs.current.set(id, node) : nodeRefs.current.delete(id)
                  }
                />
              ))}
            {visibleObjects
              .filter(
                (object) =>
                  !["wall", "door", "window"].includes(object.objectType) &&
                  selectedIds.includes(object.id) &&
                  placementByObjectId.has(object.id),
              )
              .map((object) => {
                const severity = placementByObjectId.get(object.id)!;
                const color =
                  severity === "error" ? "#c64b43" : severity === "warning" ? "#b57a18" : "#4a7f9a";
                const detectorInset = 5 / scale;
                const detectorWidth = object.dimensions.width + detectorInset * 2;
                const detectorDepth = object.dimensions.depth + detectorInset * 2;
                const left = -detectorWidth / 2;
                const right = detectorWidth / 2;
                const top = -detectorDepth / 2;
                const bottom = detectorDepth / 2;
                const corner = 13 / scale;
                const cornerLine = {
                  stroke: color,
                  strokeWidth: 1.8 / scale,
                  lineCap: "round" as const,
                  lineJoin: "round" as const,
                  listening: false,
                };
                return (
                  <Group
                    key={`placement-${object.id}`}
                    x={object.position.x}
                    y={object.position.y}
                    rotation={object.rotation.z}
                    listening={false}
                  >
                    <Rect
                      x={left}
                      y={top}
                      width={detectorWidth}
                      height={detectorDepth}
                      cornerRadius={5 / scale}
                      fill={`${color}0a`}
                      stroke={color}
                      strokeWidth={0.7 / scale}
                      opacity={0.56}
                    />
                    <Line
                      points={[left, top + corner, left, top, left + corner, top]}
                      {...cornerLine}
                    />
                    <Line
                      points={[right - corner, top, right, top, right, top + corner]}
                      {...cornerLine}
                    />
                    <Line
                      points={[left, bottom - corner, left, bottom, left + corner, bottom]}
                      {...cornerLine}
                    />
                    <Line
                      points={[right - corner, bottom, right, bottom, right, bottom - corner]}
                      {...cornerLine}
                    />
                  </Group>
                );
              })}
            {guides.map((guide, index) => (
              <Line
                key={`${guide.axis}-${guide.value}-${index}`}
                points={
                  guide.axis === "x"
                    ? [guide.value, floorPlan.bounds.minY, guide.value, floorPlan.bounds.maxY]
                    : [floorPlan.bounds.minX, guide.value, floorPlan.bounds.maxX, guide.value]
                }
                stroke="#079987"
                dash={[6 / scale, 4 / scale]}
                strokeWidth={1 / scale}
                listening={false}
              />
            ))}
            {drawStart && pointer && (
              <Line
                points={[drawStart.x, drawStart.y, pointer.x, pointer.y]}
                stroke="#079987"
                strokeWidth={2 / scale}
                dash={[8 / scale, 5 / scale]}
                listening={false}
              />
            )}
            {measure && (
              <Group listening={false}>
                <Line
                  points={[measure.start.x, measure.start.y, measure.end.x, measure.end.y]}
                  stroke="#087e70"
                  strokeWidth={1 / scale}
                  dash={[7 / scale, 4 / scale]}
                />
                <Circle x={measure.start.x} y={measure.start.y} radius={3 / scale} fill="#087e70" />
                <Circle x={measure.end.x} y={measure.end.y} radius={3 / scale} fill="#087e70" />
                <Text
                  x={(measure.start.x + measure.end.x) / 2 - 45 / scale}
                  y={(measure.start.y + measure.end.y) / 2 - 12 / scale}
                  width={90 / scale}
                  text={`${(Math.hypot(measure.end.x - measure.start.x, measure.end.y - measure.start.y) / 1000).toFixed(2)} m`}
                  align="center"
                  fontFamily="Bahnschrift"
                  fontSize={12 / scale}
                  fill="#075f56"
                />
              </Group>
            )}
            {measurementOverlays.walls && (
              <WallLengthMeasurements objects={visibleObjects} scale={scale} />
            )}
            {measurementOverlays.openings && (
              <OpeningMeasurements objects={visibleObjects} scale={scale} />
            )}
            {measurementOverlays.clearance &&
              selectedSceneObject &&
              !["wall", "door", "window", "label", "measurement"].includes(
                selectedSceneObject.objectType,
              ) && (
                <ClearanceMeasurements
                  selected={selectedSceneObject}
                  objects={visibleObjects}
                  bounds={floorPlan.bounds}
                  scale={scale}
                />
              )}
            {marquee && (
              <Rect
                x={Math.min(marquee.start.x, marquee.end.x)}
                y={Math.min(marquee.start.y, marquee.end.y)}
                width={Math.abs(marquee.end.x - marquee.start.x)}
                height={Math.abs(marquee.end.y - marquee.start.y)}
                fill="rgba(7,153,135,.09)"
                stroke="#079987"
                strokeWidth={1 / scale}
                dash={[5 / scale, 3 / scale]}
                listening={false}
              />
            )}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              borderStroke="#079987"
              borderStrokeWidth={1.4}
              anchorFill="#ffffff"
              anchorStroke="#079987"
              anchorStrokeWidth={1.5}
              anchorSize={10}
              anchorCornerRadius={3}
              rotateAnchorOffset={30}
              padding={3}
              flipEnabled={false}
              keepRatio={false}
            />
            {closedFloor && measurementOverlays.overall && (
              <PlanDimensionFrame bounds={closedFloor.bounds} scale={scale} />
            )}
          </Group>
        </Layer>
      </Stage>
      {!closedFloor && (
        <div className="canvas-floor-guidance" data-testid="canvas-floor-guidance" role="status">
          <strong>Floor not generated</strong>
          <span>Close the wall outline to create and reshape the floor.</span>
        </div>
      )}
      <div
        className="canvas-scale"
        aria-label="Drawing scale"
        style={{ "--metre-size": `${Math.min(72, Math.max(28, 1000 * scale))}px` } as CSSProperties}
      >
        <span>0</span>
        <i />
        <span>1</span>
        <i />
        <span>2</span>
        <i />
        <span>3 m</span>
      </div>
      {selectedIds.length > 0 && selectedObjectSupportsPlacementStatus && (
        <div
          className={`canvas-placement-status tone-${selectedPlacementTone}`}
          role="status"
          aria-live="polite"
          data-testid="canvas-placement-status"
        >
          <i />
          <b>{selectedPlacementTitle}</b>
          <span>
            {selectedPlacementWarnings.length > 1
              ? `${selectedPlacementWarnings.length} checks need attention`
              : (selectedPlacementWarnings[0]?.message ?? "Placement clear · no boundary or overlap conflicts")}
          </span>
        </div>
      )}
      <div
        className="canvas-coordinates"
        aria-label={coordinateLabel}
        style={{ fontSize: 0 }}
      >
        <span className="canvas-coordinate-value">{coordinateLabel}</span>
        {pointer
          ? `X ${(pointer.x / 1000).toFixed(2)} m  ·  Y ${(pointer.y / 1000).toFixed(2)} m`
          : "X —  ·  Y —"}
      </div>
    </div>
  );
}
