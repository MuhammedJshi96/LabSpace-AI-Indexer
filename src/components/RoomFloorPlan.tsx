import type { ReactNode } from "react";
import { Group, Line } from "react-konva";
import {
  resolveLaboratoryFloorFinish,
  type LaboratoryFloorFinish,
} from "../domain/laboratory-materials";
import { getRoomSpaceFloorPlans } from "../domain/room-geometry";
import type { Room } from "../domain/schema";

type RoomFloorPlanProps = {
  room: Room;
  scale: number;
  children?: ReactNode;
};

function FloorFinishPattern({
  room,
  scale,
  finish,
}: {
  room: Room;
  scale: number;
  finish: LaboratoryFloorFinish;
}) {
  const spacing = finish.patternSpacingMm;
  const shared = {
    stroke: finish.patternColor,
    strokeWidth: 1 / scale,
    opacity: finish.patternOpacity,
    listening: false,
  } as const;

  if (finish.pattern === "speckled") {
    const diagonalStarts = Array.from(
      { length: Math.ceil((room.width + room.depth) / spacing) + 1 },
      (_, index) => -room.depth + index * spacing,
    );
    return (
      <Group listening={false} clipX={0} clipY={0} clipWidth={room.width} clipHeight={room.depth}>
        {diagonalStarts.map((start) => (
          <Line
            key={start}
            points={[start, room.depth, start + room.depth, 0]}
            dash={[5 / scale, 26 / scale]}
            {...shared}
          />
        ))}
      </Group>
    );
  }

  const verticals = Array.from(
    { length: Math.floor(room.width / spacing) },
    (_, index) => (index + 1) * spacing,
  );
  if (finish.pattern === "sheet-seams") {
    return (
      <Group listening={false} clipX={0} clipY={0} clipWidth={room.width} clipHeight={room.depth}>
        {verticals.map((x) => (
          <Line key={x} points={[x, 0, x, room.depth]} {...shared} />
        ))}
      </Group>
    );
  }

  const horizontals = Array.from(
    { length: Math.floor(room.depth / spacing) },
    (_, index) => (index + 1) * spacing,
  );
  return (
    <Group listening={false} clipX={0} clipY={0} clipWidth={room.width} clipHeight={room.depth}>
      {verticals.map((x) => (
        <Line key={`vertical-${x}`} points={[x, 0, x, room.depth]} {...shared} />
      ))}
      {horizontals.map((y) => (
        <Line key={`horizontal-${y}`} points={[0, y, room.width, y]} {...shared} />
      ))}
    </Group>
  );
}

/**
 * Material-aware plan floor for one simple closed wall loop. Blank, open,
 * branched, partitioned, or invalid wall layouts intentionally have no floor;
 * their planning grid remains available through children.
 */
export function RoomFloorPlanShape({ room, scale, children }: RoomFloorPlanProps) {
  const floors = getRoomSpaceFloorPlans(room);
  const shadowProps = {
    shadowColor: "#1d2b2c",
    shadowOpacity: 0.14,
    shadowBlur: 18 / scale,
    shadowOffset: { x: 0, y: 7 / scale },
  };

  if (!floors.length) return <>{children}</>;

  return (
    <>
      {floors.map((floor) => {
        const finish = resolveLaboratoryFloorFinish(floor.floorFinish);
        return (
          <Group key={floor.spaceId} name={`room-space-${floor.spaceId}`}>
            <Line
              points={floor.points.flatMap((point) => [point.x, point.y])}
              closed
              fill={finish.planColor}
              lineJoin="round"
              listening={false}
              {...shadowProps}
            />
            <Group
              clipFunc={(context) => {
                context.beginPath();
                context.moveTo(floor.points[0].x, floor.points[0].y);
                floor.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
                context.closePath();
              }}
            >
              <FloorFinishPattern room={room} scale={scale} finish={finish} />
              {children}
            </Group>
          </Group>
        );
      })}
    </>
  );
}
