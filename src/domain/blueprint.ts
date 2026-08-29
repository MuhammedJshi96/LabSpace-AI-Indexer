export type BlueprintPoint = { x: number; y: number };

export type BlueprintTraceMetrics = {
  vertices: Array<{ xMm: number; yMm: number }>;
  widthMm: number;
  depthMm: number;
  areaM2: number;
  perimeterMm: number;
};

export type BlueprintOutlineSuggestion = {
  points: BlueprintPoint[];
  confidence: "detected" | "page-bounds";
};

function polygonArea(points: Array<{ xMm: number; yMm: number }>) {
  return Math.abs(
    points.reduce((total, point, index) => {
      const next = points[(index + 1) % points.length];
      return total + point.xMm * next.yMm - next.xMm * point.yMm;
    }, 0) / 2,
  );
}

function pointDistance(
  first: { xMm: number; yMm: number },
  second: { xMm: number; yMm: number },
) {
  return Math.hypot(second.xMm - first.xMm, second.yMm - first.yMm);
}

/**
 * Converts the researcher-reviewed image trace into the exact input contract
 * used by the WebMCP room planner. Image pixels never enter the project data.
 */
export function blueprintTraceToRoomVertices(
  points: BlueprintPoint[],
  millimetresPerPixel: number,
): BlueprintTraceMetrics {
  if (!Number.isFinite(millimetresPerPixel) || millimetresPerPixel <= 0) {
    throw new Error("Set a known dimension before creating the room proposal.");
  }
  const openPoints =
    points.length > 3 &&
    Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) < 2
      ? points.slice(0, -1)
      : points;
  if (openPoints.length < 3 || openPoints.length > 16) {
    throw new Error("Trace between 3 and 16 ordered room corners.");
  }
  const minX = Math.min(...openPoints.map((point) => point.x));
  const minY = Math.min(...openPoints.map((point) => point.y));
  const snap = (value: number) => Math.round(value / 10) * 10;
  const vertices = openPoints.map((point) => ({
    xMm: snap((point.x - minX) * millimetresPerPixel),
    yMm: snap((point.y - minY) * millimetresPerPixel),
  }));
  if (
    vertices.some((point, index) => pointDistance(point, vertices[(index + 1) % vertices.length]) < 500)
  ) {
    throw new Error("Every traced wall must be at least 0.50 m long.");
  }
  const widthMm = Math.max(...vertices.map((point) => point.xMm));
  const depthMm = Math.max(...vertices.map((point) => point.yMm));
  if (widthMm < 3000 || depthMm < 3000) {
    throw new Error("The traced room must be at least 3.00 m wide and deep.");
  }
  if (widthMm > 20_000 || depthMm > 20_000) {
    throw new Error("This import supports room outlines up to 20.00 m per axis.");
  }
  const areaMm2 = polygonArea(vertices);
  if (areaMm2 < 9_000_000) {
    throw new Error("The traced room must contain at least 9.00 m².");
  }
  const perimeterMm = vertices.reduce(
    (total, point, index) => total + pointDistance(point, vertices[(index + 1) % vertices.length]),
    0,
  );
  return {
    vertices,
    widthMm,
    depthMm,
    areaM2: areaMm2 / 1_000_000,
    perimeterMm,
  };
}

type AxisCluster = { position: number; strength: number };

function lineClusters(values: number[], minimumStrength: number): AxisCluster[] {
  const clusters: Array<{ start: number; end: number; strength: number }> = [];
  values.forEach((strength, position) => {
    if (strength < minimumStrength) return;
    const previous = clusters.at(-1);
    if (previous && position - previous.end <= 2) {
      previous.end = position;
      previous.strength = Math.max(previous.strength, strength);
    } else {
      clusters.push({ start: position, end: position, strength });
    }
  });
  return clusters.map((cluster) => ({
    position: (cluster.start + cluster.end) / 2,
    strength: cluster.strength,
  }));
}

function strongestSeparatedPair(clusters: AxisCluster[], span: number) {
  let result: [AxisCluster, AxisCluster] | null = null;
  let score = -1;
  for (let first = 0; first < clusters.length; first += 1) {
    for (let second = first + 1; second < clusters.length; second += 1) {
      const distance = clusters[second].position - clusters[first].position;
      if (distance < span * 0.25) continue;
      const candidate = distance * Math.min(clusters[first].strength, clusters[second].strength);
      if (candidate > score) {
        score = candidate;
        result = [clusters[first], clusters[second]];
      }
    }
  }
  return result;
}

/**
 * Finds the strongest long horizontal and vertical line pairs in a blueprint.
 * It deliberately returns only a suggestion; the researcher can drag or replace
 * every corner before anything reaches the reversible room-plan preview.
 */
export function suggestBlueprintRectangle(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): BlueprintOutlineSuggestion {
  if (rgba.length < width * height * 4 || width < 20 || height < 20) {
    throw new Error("The blueprint image is too small to analyse.");
  }
  const columns = Array.from({ length: width }, () => 0);
  const rows = Array.from({ length: height }, () => 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (rgba[offset + 3] < 40) continue;
      const luminance = rgba[offset] * 0.2126 + rgba[offset + 1] * 0.7152 + rgba[offset + 2] * 0.0722;
      if (luminance > 176) continue;
      columns[x] += 1;
      rows[y] += 1;
    }
  }
  const verticalPair = strongestSeparatedPair(lineClusters(columns, height * 0.19), width);
  const horizontalPair = strongestSeparatedPair(lineClusters(rows, width * 0.19), height);
  if (verticalPair && horizontalPair) {
    const [left, right] = verticalPair;
    const [top, bottom] = horizontalPair;
    return {
      confidence: "detected",
      points: [
        { x: left.position, y: top.position },
        { x: right.position, y: top.position },
        { x: right.position, y: bottom.position },
        { x: left.position, y: bottom.position },
      ],
    };
  }
  const insetX = width * 0.08;
  const insetY = height * 0.08;
  return {
    confidence: "page-bounds",
    points: [
      { x: insetX, y: insetY },
      { x: width - insetX, y: insetY },
      { x: width - insetX, y: height - insetY },
      { x: insetX, y: height - insetY },
    ],
  };
}
