import { useMemo, useState } from "react";
import { assetThumbnailKind } from "../domain/asset-thumbnail";
import type { AssetDefinition } from "../domain/schema";
import { assetRenderKind, assetRenderSource } from "../lib/asset-render-path";

type Paint = string | CanvasGradient | CanvasPattern;
type MaterialPalette = {
  top: string;
  front: string;
  side: string;
  edge: string;
  highlight: string;
  recess: string;
  metal: string;
  glass: string;
};

const materials: Record<AssetDefinition["material"], MaterialPalette> = {
  white: {
    top: "#f8faf9",
    front: "#dce2e0",
    side: "#bbc5c2",
    edge: "#52605e",
    highlight: "#ffffff",
    recess: "#879391",
    metal: "#aab6b4",
    glass: "rgba(145,199,205,.56)",
  },
  steel: {
    top: "#edf1f0",
    front: "#bcc6c4",
    side: "#8e9b99",
    edge: "#465351",
    highlight: "#ffffff",
    recess: "#687573",
    metal: "#cbd3d1",
    glass: "rgba(135,190,198,.55)",
  },
  dark: {
    top: "#566266",
    front: "#344044",
    side: "#202a2d",
    edge: "#11191b",
    highlight: "#879294",
    recess: "#12191c",
    metal: "#8e9b99",
    glass: "rgba(109,170,180,.55)",
  },
  glass: {
    top: "rgba(220,241,242,.8)",
    front: "rgba(159,207,212,.72)",
    side: "rgba(112,174,182,.68)",
    edge: "#4c7277",
    highlight: "#f7ffff",
    recess: "#5f878c",
    metal: "#aebcba",
    glass: "rgba(143,211,217,.55)",
  },
  yellow: {
    top: "#f6da63",
    front: "#d8b536",
    side: "#aa8620",
    edge: "#695814",
    highlight: "#fff2a8",
    recess: "#766115",
    metal: "#a7b1af",
    glass: "rgba(150,202,207,.55)",
  },
  red: {
    top: "#e88d86",
    front: "#c95851",
    side: "#963b37",
    edge: "#652926",
    highlight: "#ffd0cc",
    recess: "#7c302c",
    metal: "#aab4b2",
    glass: "rgba(146,199,204,.55)",
  },
  blue: {
    top: "#91b5c6",
    front: "#638ea3",
    side: "#426b7f",
    edge: "#294a5a",
    highlight: "#cce4ed",
    recess: "#31596b",
    metal: "#a8b5b4",
    glass: "rgba(144,207,214,.55)",
  },
};

function paletteFor(asset: AssetDefinition) {
  return materials[asset.material];
}

function gradient(
  context: CanvasRenderingContext2D,
  start: [number, number],
  end: [number, number],
  colors: [string, string],
) {
  const fill = context.createLinearGradient(start[0], start[1], end[0], end[1]);
  fill.addColorStop(0, colors[0]);
  fill.addColorStop(1, colors[1]);
  return fill;
}

function polygon(
  context: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  fill: Paint,
  stroke: string,
  lineWidth = 1,
) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) context.lineTo(x, y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: Paint,
  stroke: string,
  lineWidth = 1,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
}

function line(
  context: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  stroke: string,
  lineWidth = 1,
) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) context.lineTo(x, y);
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
}

function circle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: Paint,
  stroke: string,
  lineWidth = 1,
) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
}

function studioShadow(context: CanvasRenderingContext2D, x = 82, y = 89, rx = 52, ry = 7) {
  context.save();
  context.filter = "blur(3px)";
  context.globalAlpha = 0.2;
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  context.fillStyle = "#25312f";
  context.fill();
  context.restore();
}

function isoBox(
  context: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; depth: number; height: number },
  palette: MaterialPalette,
  overrides: Partial<Pick<MaterialPalette, "top" | "front" | "side" | "edge">> = {},
) {
  const { x, y, width, depth, height } = box;
  const top = overrides.top ?? palette.top;
  const front = overrides.front ?? palette.front;
  const side = overrides.side ?? palette.side;
  const edge = overrides.edge ?? palette.edge;
  polygon(
    context,
    [
      [x, y],
      [x + width, y - depth],
      [x + width + depth, y],
      [x + depth, y + depth],
    ],
    gradient(context, [x, y - depth], [x + width + depth, y + depth], [palette.highlight, top]),
    edge,
  );
  polygon(
    context,
    [
      [x + depth, y + depth],
      [x + width + depth, y],
      [x + width + depth, y + height],
      [x + depth, y + depth + height],
    ],
    gradient(context, [x, y], [x, y + height], [front, palette.recess]),
    edge,
  );
  polygon(
    context,
    [
      [x, y],
      [x + depth, y + depth],
      [x + depth, y + depth + height],
      [x, y + height],
    ],
    gradient(context, [x, y], [x + depth, y + height], [side, palette.recess]),
    edge,
  );
}

function isoCylinder(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  height: number,
  palette: MaterialPalette,
  fill = palette.front,
) {
  context.fillStyle = gradient(context, [x - rx, y], [x + rx, y], [palette.side, fill]);
  context.strokeStyle = palette.edge;
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(x, y + height, rx, ry, 0, 0, Math.PI);
  context.lineTo(x - rx, y);
  context.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
  context.lineTo(x + rx, y + height);
  context.fill();
  context.stroke();
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  context.fillStyle = gradient(context, [x, y - ry], [x, y + ry], [palette.highlight, fill]);
  context.fill();
  context.stroke();
}

function drawScreen(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
) {
  roundedRect(context, x, y, width, height, 1.5, "#1e292c", "#4b5958");
  roundedRect(context, x + 2, y + 2, width - 4, height - 4, 1, accent, "#90b7b1", 0.5);
  context.globalAlpha = 0.45;
  line(
    context,
    [
      [x + 4, y + height / 2],
      [x + width - 4, y + height / 2],
    ],
    "#e8fbf7",
    0.7,
  );
  context.globalAlpha = 1;
}

function drawCaster(context: CanvasRenderingContext2D, x: number, y: number) {
  line(
    context,
    [
      [x, y - 4],
      [x, y],
    ],
    "#596563",
    1.3,
  );
  circle(context, x, y + 2, 2.4, "#20282a", "#101617", 0.7);
}

function drawDoorOrWindow(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 81, 88, 35, 5);
  if (asset.profile === "window") {
    roundedRect(context, 35, 24, 90, 52, 2, palette.metal, palette.edge, 2);
    roundedRect(context, 41, 30, 78, 40, 1, palette.glass, "#4e7479", 1.2);
    line(
      context,
      [
        [80, 30],
        [80, 70],
      ],
      palette.edge,
      1.5,
    );
    line(
      context,
      [
        [42, 33],
        [76, 33],
      ],
      "rgba(255,255,255,.85)",
      1.2,
    );
    return;
  }
  const doubleDoor = asset.id === "double-door";
  const sliding = asset.id === "sliding-door";
  const frameX = doubleDoor ? 30 : 49;
  const frameWidth = doubleDoor ? 100 : 62;
  roundedRect(context, frameX, 13, frameWidth, 73, 2, palette.metal, palette.edge, 2);
  roundedRect(
    context,
    frameX + 5,
    18,
    frameWidth - 10,
    64,
    1,
    sliding
      ? palette.glass
      : gradient(context, [frameX, 18], [frameX + frameWidth, 82], ["#b88756", "#7e5539"]),
    palette.edge,
  );
  if (doubleDoor || sliding)
    line(
      context,
      [
        [80, 19],
        [80, 81],
      ],
      palette.edge,
      1.3,
    );
  if (!sliding) {
    circle(context, doubleDoor ? 75 : frameX + frameWidth - 13, 53, 2, "#d6c07d", "#695c38");
    roundedRect(context, frameX + 13, 28, frameWidth - 26, 22, 1, palette.glass, "#78969a", 0.8);
  }
}

function drawBench(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 84, 90, 58, 7);
  if (asset.id === "corner-lab-bench") {
    isoBox(context, { x: 27, y: 39, width: 67, depth: 15, height: 8 }, palette, {
      top: "#272f32",
      front: "#374144",
    });
    isoBox(context, { x: 78, y: 49, width: 39, depth: 15, height: 8 }, palette, {
      top: "#272f32",
      front: "#374144",
    });
    isoBox(context, { x: 34, y: 54, width: 27, depth: 13, height: 27 }, palette);
    isoBox(context, { x: 87, y: 62, width: 27, depth: 12, height: 20 }, palette);
    return;
  }
  const wide = asset.id === "center-island-bench";
  const x = wide ? 20 : 27;
  const width = wide ? 86 : 76;
  const depth = wide ? 23 : 17;
  isoBox(context, { x, y: 38, width, depth, height: 7 }, palette, {
    top: "#242d30",
    front: "#3b4548",
    side: "#1b2326",
  });
  isoBox(context, { x: x + 8, y: 52, width: width * 0.38, depth: 13, height: 26 }, palette);
  isoBox(
    context,
    { x: x + width * 0.54, y: 45, width: width * 0.31, depth: 13, height: 26 },
    palette,
  );
  const drawerStart = x + width * 0.54 + 13;
  for (let index = 1; index < 3; index += 1)
    line(
      context,
      [
        [drawerStart, 51 + index * 8],
        [x + width + depth - 4, 46 + index * 8],
      ],
      "#8a9693",
      0.7,
    );
  if (asset.id === "lab-bench-sink") {
    polygon(
      context,
      [
        [x + 48, 35],
        [x + 69, 30],
        [x + 78, 34],
        [x + 57, 40],
      ],
      "#7f908f",
      "#303a3d",
    );
    context.beginPath();
    context.arc(x + 70, 27, 8, Math.PI, Math.PI * 1.85);
    context.strokeStyle = "#8d9a98";
    context.lineWidth = 2;
    context.stroke();
  }
  if (asset.id === "mobile-bench") {
    drawCaster(context, x + 14, 84);
    drawCaster(context, x + width + depth - 10, 80);
  }
}

function drawTable(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 82, 88, 51, 6);
  isoBox(context, { x: 31, y: 39, width: 75, depth: 18, height: 6 }, palette, {
    top: asset.id === "office-desk" ? "#c9b18d" : palette.top,
  });
  for (const [x, y] of [
    [38, 57],
    [105, 42],
    [50, 72],
    [121, 57],
  ] as Array<[number, number]>)
    line(
      context,
      [
        [x, y],
        [x, y + 21],
      ],
      palette.edge,
      2.2,
    );
  if (asset.id === "office-desk") {
    isoBox(context, { x: 81, y: 30, width: 25, depth: 5, height: 17 }, materials.dark);
    line(
      context,
      [
        [99, 49],
        [99, 54],
      ],
      palette.edge,
      1.5,
    );
  }
}

function drawSeat(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 80, 91, 31, 5);
  const stool = asset.id === "round-stool";
  if (!stool) {
    roundedRect(
      context,
      61,
      19,
      39,
      27,
      7,
      gradient(context, [61, 19], [100, 46], [palette.top, palette.front]),
      palette.edge,
    );
    line(
      context,
      [
        [66, 44],
        [69, 59],
      ],
      palette.edge,
      2.4,
    );
    line(
      context,
      [
        [95, 44],
        [93, 59],
      ],
      palette.edge,
      2.4,
    );
  }
  context.beginPath();
  context.ellipse(80, stool ? 43 : 57, 22, 9, -0.08, 0, Math.PI * 2);
  context.fillStyle = gradient(context, [58, 49], [102, 64], [palette.top, palette.front]);
  context.fill();
  context.strokeStyle = palette.edge;
  context.stroke();
  line(
    context,
    [
      [80, stool ? 51 : 65],
      [80, 79],
    ],
    palette.edge,
    3,
  );
  for (const end of [
    [55, 88],
    [69, 92],
    [92, 92],
    [106, 86],
  ] as Array<[number, number]>)
    line(context, [[80, 79], end], palette.edge, 1.7);
  for (const [x, y] of [
    [55, 88],
    [69, 92],
    [92, 92],
    [106, 86],
  ] as Array<[number, number]>)
    circle(context, x, y, 2.2, "#252d2f", "#111718");
}

function drawCart(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 83, 92, 52, 6);
  const bottleCart = asset.id === "rolling-bottle-cart";
  const shelves = bottleCart ? [44, 65] : [37, 57, 75];
  for (const y of shelves)
    isoBox(context, { x: 31, y, width: 68, depth: 17, height: 4 }, palette, {
      top: bottleCart ? "#4d8b5d" : palette.metal,
    });
  for (const x of [33, 47, 101, 116])
    line(
      context,
      [
        [x, 28],
        [x, 86],
      ],
      palette.edge,
      2,
    );
  if (bottleCart) {
    for (const y of [40, 61])
      for (let index = 0; index < 5; index += 1) {
        const x = 47 + index * 12;
        roundedRect(
          context,
          x,
          y - 13,
          7,
          14,
          2,
          index % 2 ? "#765242" : "#3e4744",
          "#232b2a",
          0.6,
        );
        roundedRect(context, x + 2, y - 16, 3, 4, 1, "#e3e7e5", "#78817f", 0.4);
      }
  }
  drawCaster(context, 37, 89);
  drawCaster(context, 113, 87);
}

function drawCabinet(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 84, 91, asset.profile === "tall" ? 40 : 50, 6);
  const tall = ["tall", "locker"].includes(asset.profile);
  const x = tall ? 48 : 31;
  const y = tall ? 22 : 43;
  const width = tall ? 47 : 72;
  const depth = tall ? 14 : 18;
  const height = tall ? 62 : 35;
  isoBox(context, { x, y, width, depth, height }, palette);
  const frontLeft = x + depth + 5;
  const frontRight = x + width + depth - 5;
  if (asset.id.includes("drawer") || asset.id === "mobile-drawer") {
    for (let index = 1; index < 4; index += 1) {
      const yy = y + depth + index * (height / 4);
      line(
        context,
        [
          [frontLeft, yy],
          [frontRight, yy - depth * 0.18],
        ],
        palette.edge,
        0.7,
      );
      line(
        context,
        [
          [77, yy - 2],
          [87, yy - 3],
        ],
        palette.highlight,
        1.2,
      );
    }
  } else {
    line(
      context,
      [
        [x + depth + width / 2, y + depth],
        [x + depth + width / 2, y + depth + height],
      ],
      palette.edge,
      0.8,
    );
    if (asset.id === "glass-wall-cabinet") {
      roundedRect(
        context,
        frontLeft,
        y + depth + 5,
        width / 2 - 8,
        height - 10,
        1,
        palette.glass,
        palette.edge,
        0.7,
      );
      roundedRect(
        context,
        x + depth + width / 2 + 3,
        y + depth + 3,
        width / 2 - 8,
        height - 10,
        1,
        palette.glass,
        palette.edge,
        0.7,
      );
    }
    line(
      context,
      [
        [76, y + depth + height / 2],
        [80, y + depth + height / 2],
      ],
      palette.highlight,
      1.3,
    );
    line(
      context,
      [
        [85, y + depth + height / 2],
        [89, y + depth + height / 2],
      ],
      palette.highlight,
      1.3,
    );
  }
  if (asset.id === "sink-cabinet") {
    polygon(
      context,
      [
        [54, 40],
        [82, 33],
        [94, 38],
        [66, 46],
      ],
      "#728381",
      "#394442",
    );
  }
  if (asset.id === "chemical-cabinet" || asset.id === "flammable-cabinet") {
    polygon(
      context,
      [
        [77, 47],
        [84, 39],
        [91, 47],
      ],
      asset.accent,
      palette.edge,
      0.6,
    );
  }
}

function drawShelving(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 83, 92, 51, 6);
  if (asset.id === "pegboard") {
    isoBox(context, { x: 37, y: 29, width: 70, depth: 5, height: 50 }, palette);
    context.fillStyle = palette.recess;
    for (let row = 0; row < 5; row += 1)
      for (let column = 0; column < 9; column += 1)
        circle(context, 48 + column * 7, 40 + row * 7, 0.8, palette.recess, palette.recess, 0);
    return;
  }
  const basketTower = asset.id === "plastic-basket-tower";
  const x = basketTower ? 55 : 31;
  const width = basketTower ? 42 : 72;
  const depth = basketTower ? 12 : 17;
  for (const shelfY of basketTower ? [29, 44, 59, 74] : [28, 48, 68, 84])
    isoBox(context, { x, y: shelfY, width, depth, height: 3 }, palette, {
      top: basketTower ? (shelfY % 2 ? "#e47d34" : "#73a94d") : palette.metal,
      front: basketTower ? "#5f8f43" : palette.front,
    });
  for (const postX of [x + 2, x + depth + 2, x + width - 1, x + width + depth - 1])
    line(
      context,
      [
        [postX, 24],
        [postX, 89],
      ],
      palette.edge,
      1.7,
    );
  if (!basketTower && asset.id !== "slotted-angle-storage-rack") {
    for (let index = 0; index < 4; index += 1) {
      const bx = 45 + index * 18;
      roundedRect(context, bx, 51, 12, 10, 1, index % 2 ? "#d6b073" : "#7598a3", palette.edge, 0.5);
    }
  }
}

function drawHood(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 83, 92, 51, 6);
  isoBox(context, { x: 34, y: 55, width: 67, depth: 17, height: 30 }, palette);
  isoBox(context, { x: 36, y: 20, width: 64, depth: 16, height: 36 }, palette);
  polygon(
    context,
    [
      [54, 40],
      [105, 29],
      [105, 55],
      [54, 67],
    ],
    gradient(context, [54, 40], [105, 60], [palette.glass, "rgba(40,73,78,.72)"]),
    palette.edge,
    1.2,
  );
  line(
    context,
    [
      [55, 62],
      [104, 51],
    ],
    asset.accent,
    2,
  );
  drawScreen(context, 39, 27, 14, 8, asset.accent);
  if (asset.id === "fume-hood") {
    polygon(
      context,
      [
        [56, 17],
        [91, 9],
        [102, 14],
        [67, 22],
      ],
      palette.front,
      palette.edge,
    );
    isoCylinder(context, 80, 7, 8, 3, 9, palette, palette.metal);
  }
}

function drawCentrifuge(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 82, 87, 42, 6);
  const floor = asset.id === "floor-centrifuge";
  const small = asset.id === "microcentrifuge";
  const x = floor ? 45 : small ? 53 : 39;
  const y = floor ? 31 : small ? 51 : 43;
  const width = floor ? 60 : small ? 50 : 70;
  const height = floor ? 50 : small ? 27 : 34;
  roundedRect(
    context,
    x,
    y,
    width,
    height,
    floor ? 8 : 10,
    gradient(context, [x, y], [x, y + height], [palette.top, palette.front]),
    palette.edge,
  );
  context.beginPath();
  context.ellipse(x + width / 2, y + 4, width * 0.38, floor ? 9 : 7, -0.08, 0, Math.PI * 2);
  context.fillStyle = gradient(
    context,
    [x, y],
    [x + width, y + 10],
    [palette.highlight, palette.side],
  );
  context.fill();
  context.strokeStyle = palette.edge;
  context.stroke();
  context.beginPath();
  context.ellipse(x + width / 2, y + 4, width * 0.24, floor ? 5 : 4, -0.08, 0, Math.PI * 2);
  context.fillStyle = "#344144";
  context.fill();
  drawScreen(context, x + 7, y + height * 0.56, width * 0.32, 8, asset.accent);
  for (let index = 0; index < 3; index += 1)
    circle(
      context,
      x + width * 0.55 + index * 8,
      y + height * 0.7,
      2,
      index === 2 ? asset.accent : palette.metal,
      palette.edge,
      0.5,
    );
}

function drawThermal(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 83, 92, 43, 6);
  const tall = asset.defaultDimensions.height >= 1400;
  const autoclave = asset.id === "autoclave";
  const x = tall ? 45 : 37;
  const y = tall ? 21 : 42;
  const width = tall ? 53 : 68;
  const depth = tall ? 14 : 17;
  const height = tall ? 64 : 39;
  isoBox(context, { x, y, width, depth, height }, palette);
  const frontX = x + depth + 5;
  if (autoclave) {
    circle(
      context,
      frontX + width / 2 - 6,
      y + depth + height * 0.56,
      18,
      palette.metal,
      palette.edge,
      2,
    );
    circle(
      context,
      frontX + width / 2 - 6,
      y + depth + height * 0.56,
      12,
      "#4d5d60",
      palette.edge,
      1,
    );
    drawScreen(context, frontX + 2, y + depth + 5, 17, 8, asset.accent);
    return;
  }
  roundedRect(
    context,
    frontX,
    y + depth + 9,
    width - 11,
    height - 16,
    1,
    palette.front,
    palette.edge,
    0.8,
  );
  if (["incubator", "shaking-incubator", "forced-air-lab-oven"].includes(asset.id)) {
    roundedRect(
      context,
      frontX + 8,
      y + depth + 16,
      width - 27,
      height - 31,
      2,
      "#344144",
      "#151d20",
      1,
    );
    line(
      context,
      [
        [frontX + 11, y + depth + 19],
        [frontX + width - 21, y + depth + 19],
      ],
      "rgba(255,255,255,.45)",
      1,
    );
  }
  drawScreen(context, frontX + 3, y + depth + 3, 16, 7, asset.accent);
  line(
    context,
    [
      [frontX + width - 15, y + depth + 18],
      [frontX + width - 15, y + depth + height - 12],
    ],
    palette.edge,
    2,
  );
  if (asset.id.includes("freezer") || asset.id.includes("refrigerator"))
    line(
      context,
      [
        [frontX, y + depth + height * 0.52],
        [frontX + width - 11, y + depth + height * 0.48],
      ],
      palette.edge,
      0.7,
    );
}

function drawMicroscope(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 82, 91, 38, 5);
  isoBox(context, { x: 48, y: 72, width: 46, depth: 13, height: 8 }, palette);
  context.save();
  context.strokeStyle = asset.accent;
  context.lineWidth = asset.id === "stereo-microscope" ? 10 : 12;
  context.beginPath();
  context.moveTo(72, 72);
  context.bezierCurveTo(57, 55, 66, 28, 91, 27);
  context.stroke();
  context.restore();
  line(
    context,
    [
      [84, 31],
      [100, 17],
    ],
    palette.edge,
    5,
  );
  line(
    context,
    [
      [91, 33],
      [107, 20],
    ],
    palette.edge,
    4,
  );
  roundedRect(context, 80, 52, 34, 7, 1, palette.recess, palette.edge);
  for (const x of [89, 96, 103])
    line(
      context,
      [
        [x, 37],
        [x - 3, 47],
      ],
      palette.metal,
      2.2,
    );
  circle(context, 77, 64, 5, palette.metal, palette.edge);
}

function drawBalance(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 82, 88, 40, 5);
  isoBox(context, { x: 42, y: 62, width: 60, depth: 15, height: 18 }, palette);
  context.beginPath();
  context.ellipse(82, 58, 16, 5, -0.12, 0, Math.PI * 2);
  context.fillStyle = palette.metal;
  context.fill();
  context.strokeStyle = palette.edge;
  context.stroke();
  if (asset.id === "analytical-balance") {
    roundedRect(context, 56, 25, 52, 39, 2, palette.glass, palette.edge, 1);
    line(
      context,
      [
        [82, 26],
        [82, 62],
      ],
      "rgba(255,255,255,.75)",
      1,
    );
    line(
      context,
      [
        [59, 30],
        [76, 30],
      ],
      "rgba(255,255,255,.8)",
      1,
    );
  }
  drawScreen(context, 53, 75, 20, 7, asset.accent);
  for (const x of [84, 92, 100]) circle(context, x, 78, 2, palette.metal, palette.edge, 0.5);
}

function drawBenchInstrument(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 82, 88, 43, 6);
  if (asset.id === "gel-doc") {
    isoBox(context, { x: 45, y: 27, width: 54, depth: 15, height: 57 }, materials.dark);
    roundedRect(context, 62, 48, 39, 28, 2, "#151c20", "#677477", 1);
    drawScreen(context, 53, 35, 18, 8, asset.accent);
    return;
  }
  if (asset.id === "electrophoresis-tank") {
    isoBox(context, { x: 37, y: 55, width: 69, depth: 18, height: 20 }, materials.glass);
    for (const [x, color] of [
      [54, "#d7534c"],
      [101, "#252d2f"],
    ] as Array<[number, string]>) {
      circle(context, x, 51, 3, color, "#283234", 0.7);
      context.beginPath();
      context.moveTo(x, 48);
      context.bezierCurveTo(x - 5, 32, x + (x < 80 ? -16 : 16), 28, x + (x < 80 ? -20 : 20), 20);
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.stroke();
    }
    for (let index = 0; index < 6; index += 1)
      line(
        context,
        [
          [55 + index * 8, 62],
          [55 + index * 8, 74],
        ],
        "rgba(66,107,127,.6)",
        0.6,
      );
    return;
  }
  if (["hotplate-stirrer", "water-bath", "dry-block-heater", "vortex-mixer"].includes(asset.id)) {
    const isVortex = asset.id === "vortex-mixer";
    isoBox(context, { x: 43, y: 60, width: 60, depth: 16, height: isVortex ? 22 : 20 }, palette);
    if (asset.id === "hotplate-stirrer") {
      context.beginPath();
      context.ellipse(82, 52, 22, 7, -0.12, 0, Math.PI * 2);
      context.fillStyle = "#252d30";
      context.fill();
      context.strokeStyle = palette.edge;
      context.stroke();
    } else if (asset.id === "water-bath") {
      polygon(
        context,
        [
          [54, 56],
          [93, 47],
          [104, 53],
          [65, 63],
        ],
        "#607b80",
        palette.edge,
      );
      polygon(
        context,
        [
          [61, 56],
          [91, 49],
          [98, 53],
          [68, 60],
        ],
        "#8cc1c8",
        "#4c747a",
        0.7,
      );
    } else if (asset.id === "dry-block-heater") {
      polygon(
        context,
        [
          [56, 55],
          [92, 47],
          [101, 52],
          [65, 61],
        ],
        palette.metal,
        palette.edge,
      );
      for (let row = 0; row < 3; row += 1)
        for (let column = 0; column < 5; column += 1)
          circle(
            context,
            67 + column * 6 + row * 2,
            53 + row * 3 - column,
            1.4,
            palette.recess,
            palette.edge,
            0.3,
          );
    } else {
      isoCylinder(context, 82, 46, 13, 5, 10, palette, "#303a3d");
      circle(context, 82, 44, 6, "#1d2528", palette.edge);
    }
    drawScreen(context, 51, 72, 17, 6, asset.accent);
    for (const x of [83, 92, 101])
      circle(context, x, 75, 2, x === 101 ? asset.accent : palette.metal, palette.edge, 0.5);
    return;
  }
  const qpcr = asset.id === "real-time-pcr";
  const spectro = asset.id === "spectrophotometer";
  const plateReader = asset.id === "plate-reader";
  isoBox(context, { x: 38, y: 50, width: 68, depth: 18, height: 31 }, palette);
  polygon(
    context,
    [
      [49, 47],
      [94, 36],
      [107, 43],
      [62, 55],
    ],
    qpcr ? "#dad5ea" : spectro ? "#dce6e5" : palette.top,
    palette.edge,
  );
  if (plateReader) roundedRect(context, 69, 70, 31, 5, 1, "#172124", palette.edge);
  else drawScreen(context, 49, 66, qpcr ? 25 : 20, 8, asset.accent);
  for (const x of [88, 96, 104])
    circle(context, x, 71, 2, x === 104 ? asset.accent : palette.metal, palette.edge, 0.5);
}

function drawWasher(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 83, 91, 43, 6);
  isoBox(context, { x: 43, y: 33, width: 57, depth: 16, height: 51 }, palette);
  roundedRect(context, 61, 51, 42, 27, 2, "#303b3e", palette.edge, 1.2);
  roundedRect(context, 65, 55, 34, 19, 1, "rgba(126,177,184,.45)", "#617c7f", 0.7);
  drawScreen(context, 51, 40, 17, 7, asset.accent);
  for (const x of [81, 89, 97]) circle(context, x, 43, 2, palette.metal, palette.edge, 0.5);
}

function drawPump(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 82, 88, 47, 6);
  isoBox(context, { x: 36, y: 68, width: 73, depth: 16, height: 10 }, materials.dark);
  isoCylinder(context, 68, 45, 19, 7, 22, palette, "#9b7b51");
  isoCylinder(context, 102, 51, 13, 5, 17, materials.dark, "#394548");
  circle(context, 95, 39, 8, "#eef2f1", palette.edge);
  line(
    context,
    [
      [95, 39],
      [99, 35],
    ],
    "#b3524d",
    1.2,
  );
  context.beginPath();
  context.moveTo(48, 47);
  context.bezierCurveTo(46, 27, 107, 24, 119, 48);
  context.strokeStyle = palette.edge;
  context.lineWidth = 3;
  context.stroke();
  line(
    context,
    [
      [112, 52],
      [124, 45],
      [126, 34],
    ],
    asset.accent,
    2,
  );
}

function drawRotary(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 84, 92, 48, 6);
  isoBox(context, { x: 38, y: 73, width: 64, depth: 14, height: 8 }, palette);
  line(
    context,
    [
      [67, 75],
      [67, 20],
    ],
    palette.edge,
    3,
  );
  roundedRect(context, 60, 34, 35, 17, 4, palette.front, palette.edge);
  isoCylinder(context, 105, 64, 18, 6, 13, palette, "#d3d8d7");
  circle(context, 99, 51, 12, "rgba(178,216,218,.42)", "#5d7c7e", 1.2);
  line(
    context,
    [
      [91, 43],
      [110, 27],
    ],
    palette.edge,
    3,
  );
  roundedRect(context, 104, 13, 13, 31, 5, palette.glass, "#587a7d", 1);
  context.beginPath();
  context.moveTo(108, 16);
  context.bezierCurveTo(126, 10, 126, 37, 115, 50);
  context.strokeStyle = "#7d9fa1";
  context.lineWidth = 2;
  context.stroke();
}

function drawLabRig(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 83, 91, 50, 6);
  if (asset.id === "multi-position-heating-bath") {
    isoBox(context, { x: 27, y: 56, width: 91, depth: 18, height: 25 }, palette);
    for (let index = 0; index < 6; index += 1) {
      context.beginPath();
      context.ellipse(49 + index * 13, 51 - index * 1.8, 6, 2.4, -0.12, 0, Math.PI * 2);
      context.fillStyle = "#30393b";
      context.fill();
      context.strokeStyle = palette.edge;
      context.stroke();
      circle(
        context,
        45 + index * 13,
        73 - index * 0.5,
        2,
        index % 2 ? "#cf5d55" : "#d5b24a",
        palette.edge,
        0.4,
      );
    }
    return;
  }
  if (asset.id === "stainless-process-vessel") {
    isoCylinder(context, 82, 27, 26, 9, 51, palette, palette.metal);
    isoCylinder(context, 82, 23, 28, 9, 5, palette, palette.metal);
    line(
      context,
      [
        [52, 49],
        [43, 49],
        [43, 61],
      ],
      palette.edge,
      2,
    );
    line(
      context,
      [
        [112, 49],
        [121, 49],
        [121, 61],
      ],
      palette.edge,
      2,
    );
    circle(context, 82, 19, 3, asset.accent, palette.edge, 0.6);
    return;
  }
  if (asset.id === "retort-stand-assembly") {
    isoBox(context, { x: 43, y: 76, width: 69, depth: 14, height: 7 }, materials.dark);
    line(
      context,
      [
        [79, 78],
        [79, 16],
      ],
      palette.edge,
      3,
    );
    line(
      context,
      [
        [79, 31],
        [122, 23],
      ],
      palette.edge,
      2,
    );
    line(
      context,
      [
        [79, 49],
        [42, 56],
      ],
      palette.edge,
      2,
    );
    for (const [x, y] of [
      [117, 25],
      [47, 55],
    ] as Array<[number, number]>) {
      circle(context, x, y, 6, "rgba(176,211,214,.35)", "#526f72", 1);
      line(
        context,
        [
          [x - 8, y],
          [x + 8, y],
        ],
        palette.edge,
        1,
      );
    }
    return;
  }
  isoBox(context, { x: 44, y: 57, width: 61, depth: 16, height: 27 }, palette);
  isoCylinder(context, 82, 26, 20, 7, 31, materials.steel, "#d1d8d6");
  roundedRect(context, 67, 17, 30, 11, 4, palette.glass, "#5e7a7d", 1);
  circle(context, 105, 33, 7, "#eef2f1", palette.edge);
  line(
    context,
    [
      [105, 33],
      [109, 29],
    ],
    "#c3544d",
    1,
  );
  context.beginPath();
  context.moveTo(97, 21);
  context.bezierCurveTo(124, 17, 123, 61, 111, 72);
  context.strokeStyle = asset.accent;
  context.lineWidth = 2;
  context.stroke();
}

function drawGas(context: CanvasRenderingContext2D, palette: MaterialPalette) {
  studioShadow(context, 82, 92, 26, 5);
  isoCylinder(context, 82, 27, 21, 7, 53, palette, "#98aaa6");
  roundedRect(context, 72, 17, 20, 13, 5, palette.front, palette.edge);
  line(
    context,
    [
      [76, 18],
      [76, 10],
      [88, 10],
      [88, 18],
    ],
    palette.edge,
    2,
  );
  circle(context, 82, 14, 3, "#c6b24f", palette.edge, 0.7);
}

function drawWorkstation(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 83, 90, 50, 6);
  if (asset.id === "printer") {
    isoBox(context, { x: 40, y: 54, width: 70, depth: 17, height: 29 }, palette);
    polygon(
      context,
      [
        [57, 46],
        [94, 37],
        [108, 44],
        [70, 53],
      ],
      "#f7f9f8",
      palette.edge,
    );
    roundedRect(context, 57, 70, 44, 7, 1, "#2a3335", palette.edge);
    drawScreen(context, 49, 62, 14, 7, asset.accent);
    return;
  }
  drawTable(context, asset, palette);
  isoBox(context, { x: 77, y: 29, width: 35, depth: 6, height: 27 }, materials.dark);
  roundedRect(context, 84, 34, 27, 18, 1, "#172124", "#5d6968", 0.8);
  line(
    context,
    [
      [99, 57],
      [99, 62],
    ],
    palette.edge,
    2,
  );
  polygon(
    context,
    [
      [66, 56],
      [94, 49],
      [105, 54],
      [77, 62],
    ],
    "#4a5557",
    palette.edge,
    0.7,
  );
}

function drawSafety(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 82, 92, 37, 5);
  if (asset.id === "fire-extinguisher") {
    isoCylinder(context, 82, 38, 16, 5, 41, materials.red, "#c94f49");
    line(
      context,
      [
        [76, 35],
        [76, 24],
        [90, 24],
        [90, 35],
      ],
      palette.edge,
      2,
    );
    roundedRect(context, 77, 20, 18, 7, 3, "#303a3c", palette.edge);
    context.beginPath();
    context.moveTo(94, 24);
    context.bezierCurveTo(116, 25, 113, 54, 101, 63);
    context.strokeStyle = "#222a2c";
    context.lineWidth = 2;
    context.stroke();
    return;
  }
  if (asset.id === "safety-shower") {
    line(
      context,
      [
        [82, 88],
        [82, 18],
        [113, 18],
        [113, 29],
      ],
      palette.edge,
      3,
    );
    context.beginPath();
    context.ellipse(113, 32, 17, 5, 0, 0, Math.PI * 2);
    context.fillStyle = "#d7c13b";
    context.fill();
    context.strokeStyle = palette.edge;
    context.stroke();
    for (const x of [102, 108, 114, 120, 126])
      line(
        context,
        [
          [x, 35],
          [x - 2, 44],
        ],
        "#6eaeb5",
        1,
      );
    line(
      context,
      [
        [84, 48],
        [99, 54],
      ],
      "#c74d47",
      2,
    );
    circle(context, 101, 55, 4, "#c74d47", palette.edge, 0.6);
    return;
  }
  isoBox(context, { x: 46, y: 65, width: 58, depth: 15, height: 14 }, palette);
  for (const x of [67, 95]) {
    context.beginPath();
    context.ellipse(x, 57, 13, 5, -0.1, 0, Math.PI * 2);
    context.fillStyle = "#d8c444";
    context.fill();
    context.strokeStyle = palette.edge;
    context.stroke();
  }
  context.beginPath();
  context.moveTo(83, 63);
  context.bezierCurveTo(79, 43, 89, 32, 98, 28);
  context.strokeStyle = palette.edge;
  context.lineWidth = 2;
  context.stroke();
  line(
    context,
    [
      [98, 28],
      [104, 34],
    ],
    "#6eaeb5",
    1.5,
  );
}

function drawWaste(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 82, 91, 36, 5);
  isoBox(context, { x: 48, y: 45, width: 50, depth: 15, height: 38 }, palette);
  polygon(
    context,
    [
      [43, 43],
      [96, 31],
      [112, 39],
      [59, 52],
    ],
    asset.id === "biological-waste-bin" ? "#e0c344" : palette.top,
    palette.edge,
  );
  roundedRect(context, 70, 57, 25, 16, 1, "#f2eee1", palette.edge, 0.6);
  if (asset.id === "biological-waste-bin") {
    circle(context, 82, 65, 5, "#2c3435", "#2c3435", 0);
    context.fillStyle = "#e0c344";
    context.font = "700 8px sans-serif";
    context.textAlign = "center";
    context.fillText("!", 82, 68);
  }
}

function drawGeneric(
  context: CanvasRenderingContext2D,
  asset: AssetDefinition,
  palette: MaterialPalette,
) {
  studioShadow(context, 83, 89, 45, 6);
  const maxHorizontal = Math.max(asset.defaultDimensions.width, asset.defaultDimensions.depth);
  const boxWidth = 58 + (asset.defaultDimensions.width / maxHorizontal) * 24;
  const boxDepth = 11 + (asset.defaultDimensions.depth / maxHorizontal) * 9;
  const boxHeight = 22 + Math.min(26, asset.defaultDimensions.height / 100);
  isoBox(
    context,
    {
      x: 80 - (boxWidth + boxDepth) / 2,
      y: 40,
      width: boxWidth,
      depth: boxDepth,
      height: boxHeight,
    },
    palette,
  );
  drawScreen(context, 57, 62, 20, 8, asset.accent);
  for (const x of [91, 100, 109])
    circle(context, x, 66, 2, x === 109 ? asset.accent : palette.metal, palette.edge, 0.5);
}

// Exported for deterministic visual-pipeline checks and custom asset previews.
// eslint-disable-next-line react-refresh/only-export-components
export function drawAssetThumbnail(canvas: HTMLCanvasElement, asset: AssetDefinition) {
  const width = 160;
  const height = 104;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(dpr, dpr);
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.lineJoin = "round";
  context.lineCap = "round";
  const palette = paletteFor(asset);
  const kind = assetThumbnailKind(asset);

  if (kind === "wall") {
    studioShadow(context, 82, 83, 49, 6);
    isoBox(
      context,
      { x: 34, y: 42, width: 78, depth: 17, height: asset.id === "half-height-wall" ? 25 : 43 },
      palette,
    );
  } else if (kind === "column") {
    studioShadow(context, 82, 90, 27, 5);
    isoBox(context, { x: 59, y: 27, width: 34, depth: 19, height: 54 }, palette);
  } else if (kind === "door" || kind === "window") drawDoorOrWindow(context, asset, palette);
  else if (kind === "bench") drawBench(context, asset, palette);
  else if (kind === "table") drawTable(context, asset, palette);
  else if (kind === "seat") drawSeat(context, asset, palette);
  else if (kind === "cart") drawCart(context, asset, palette);
  else if (kind === "cabinet") drawCabinet(context, asset, palette);
  else if (kind === "shelving") drawShelving(context, asset, palette);
  else if (kind === "hood") drawHood(context, asset, palette);
  else if (kind === "centrifuge") drawCentrifuge(context, asset, palette);
  else if (kind === "thermal") drawThermal(context, asset, palette);
  else if (kind === "microscope") drawMicroscope(context, asset, palette);
  else if (kind === "balance") drawBalance(context, asset, palette);
  else if (kind === "bench-instrument") drawBenchInstrument(context, asset, palette);
  else if (kind === "washer") drawWasher(context, asset, palette);
  else if (kind === "pump") drawPump(context, asset, palette);
  else if (kind === "rotary") drawRotary(context, asset, palette);
  else if (kind === "lab-rig") drawLabRig(context, asset, palette);
  else if (kind === "gas") drawGas(context, palette);
  else if (kind === "workstation") drawWorkstation(context, asset, palette);
  else if (kind === "safety") drawSafety(context, asset, palette);
  else if (kind === "waste") drawWaste(context, asset, palette);
  else drawGeneric(context, asset, palette);
}

const thumbnailCache = new Map<string, string>();
const normalizedThumbnailCache = new Map<string, string>();

/**
 * Authored and procedural renders do not all carry the same transparent studio
 * margins. CSS object-fit aligns the PNG canvases, not the visible objects, so
 * a door can appear high while a bench appears low even inside equal cards.
 * Reframe the alpha-bounded silhouette onto one shared, baseline-aligned canvas.
 */
function normalizeThumbnailSilhouette(image: HTMLImageElement, source: string) {
  const cached = normalizedThumbnailCache.get(source);
  if (cached) return cached;
  if (!image.naturalWidth || !image.naturalHeight) return null;

  const analysis = document.createElement("canvas");
  analysis.width = image.naturalWidth;
  analysis.height = image.naturalHeight;
  const context = analysis.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);

  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, analysis.width, analysis.height).data;
  } catch {
    return null;
  }
  let minX = analysis.width;
  let minY = analysis.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < analysis.height; y += 1) {
    for (let x = 0; x < analysis.width; x += 1) {
      if (pixels[(y * analysis.width + x) * 4 + 3] <= 32) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const framed = document.createElement("canvas");
  framed.width = 360;
  framed.height = 300;
  const framedContext = framed.getContext("2d");
  if (!framedContext) return null;
  const horizontalInset = 28;
  const topInset = 22;
  const baseline = framed.height - 25;
  const scale = Math.min(
    (framed.width - horizontalInset * 2) / cropWidth,
    (baseline - topInset) / cropHeight,
  );
  const renderedWidth = cropWidth * scale;
  const renderedHeight = cropHeight * scale;
  const targetX = (framed.width - renderedWidth) / 2;
  const targetY = baseline - renderedHeight;
  framedContext.imageSmoothingEnabled = true;
  framedContext.imageSmoothingQuality = "high";
  framedContext.drawImage(
    image,
    minX,
    minY,
    cropWidth,
    cropHeight,
    targetX,
    targetY,
    renderedWidth,
    renderedHeight,
  );
  const result = framed.toDataURL("image/png");
  normalizedThumbnailCache.set(source, result);
  return result;
}

export function AssetThumbnail({
  asset,
  className = "",
}: {
  asset: AssetDefinition;
  className?: string;
}) {
  const [failedRenderSource, setFailedRenderSource] = useState<string | null>(null);
  const [loadedRenderSource, setLoadedRenderSource] = useState<string | null>(null);
  const [normalizedRender, setNormalizedRender] = useState<{
    source: string;
    dataUrl: string;
  } | null>(null);
  const renderSource = assetRenderSource(asset, "isometric");
  const renderImageFailed = failedRenderSource === renderSource;
  const fallbackSource = useMemo(() => {
    if (!renderImageFailed) return null;
    const cacheKey = [
      asset.id,
      asset.material,
      asset.accent,
      asset.defaultDimensions.width,
      asset.defaultDimensions.depth,
      asset.defaultDimensions.height,
    ].join(":");
    const cached = thumbnailCache.get(cacheKey);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    drawAssetThumbnail(canvas, asset);
    const dataUrl = canvas.toDataURL("image/png");
    thumbnailCache.set(cacheKey, dataUrl);
    return dataUrl;
  }, [asset, renderImageFailed]);
  const renderedSource = !renderImageFailed ? renderSource : null;
  const baseSource = renderedSource ?? fallbackSource ?? "";
  const normalizedSource =
    normalizedRender?.source === baseSource
      ? normalizedRender.dataUrl
      : normalizedThumbnailCache.get(baseSource);
  const activeSource = normalizedSource ?? baseSource;
  const isLoaded = loadedRenderSource === activeSource;
  const renderKind = assetRenderKind(asset);

  return (
    <img
      key={activeSource}
      src={activeSource}
      className={`asset-thumbnail ${isLoaded ? "is-ready" : "is-loading"} ${className}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      decoding="async"
      onLoad={(event) => {
        if (!normalizedSource && activeSource === baseSource) {
          const normalized = normalizeThumbnailSilhouette(event.currentTarget, baseSource);
          if (normalized) {
            setNormalizedRender({ source: baseSource, dataUrl: normalized });
            return;
          }
        }
        setLoadedRenderSource(activeSource);
      }}
      onError={() => {
        setLoadedRenderSource(null);
        if (activeSource === baseSource) setFailedRenderSource(renderSource);
      }}
      data-render-source={
        renderedSource ? (renderKind === "authored" ? "3d" : "procedural-3d") : "illustrated"
      }
      data-thumbnail-kind={assetThumbnailKind(asset)}
      data-thumbnail-alignment="alpha-baseline"
    />
  );
}
