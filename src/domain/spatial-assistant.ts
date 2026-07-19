import {
  buildDigitalTwinIndex,
  type DigitalTwinRecord,
} from "./digital-twin-index";
import { objectBounds, validatePlacement, type ValidationWarning } from "./geometry";
import type { Project, Room, SceneObject } from "./schema";

export type SpatialAssistantMode = "grounded-local" | "gpt-5.6";

export type SpatialAssistantEvidence = Pick<
  DigitalTwinRecord,
  | "id"
  | "kind"
  | "name"
  | "roomId"
  | "roomName"
  | "objectId"
  | "locationId"
  | "path"
  | "indexCode"
  | "status"
  | "primaryLabel"
  | "primaryValue"
  | "secondaryLabel"
  | "secondaryValue"
  | "notes"
>;

export type PlacementSuggestion = {
  objectId: string;
  roomId: string;
  position: SceneObject["position"];
  distanceMm: number;
  rationale: string;
};

export type PlacementReview = {
  objectId: string;
  objectName: string;
  safe: boolean;
  warnings: ValidationWarning[];
  facts: string[];
  caveats: string[];
  suggestion: PlacementSuggestion | null;
};

export type SpatialAssistantAnswer = {
  mode: SpatialAssistantMode;
  intent: "locate" | "placement" | "maintenance" | "missing-location" | "search";
  summary: string;
  facts: string[];
  suggestions: string[];
  caveats: string[];
  evidence: SpatialAssistantEvidence[];
  focus: {
    roomId: string | null;
    objectIds: string[];
    locationIds: string[];
  };
  placementReview: PlacementReview | null;
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "can",
  "contains",
  "do",
  "does",
  "for",
  "here",
  "i",
  "in",
  "is",
  "it",
  "its",
  "me",
  "of",
  "on",
  "please",
  "show",
  "the",
  "there",
  "to",
  "what",
  "where",
  "which",
  "with",
]);

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function queryTerms(query: string) {
  const normalized = normalizeText(query);
  const base = normalized.split(/\s+/).filter((term) => term && !stopWords.has(term));
  const expanded = new Set(base);
  if (expanded.has("buchi") || expanded.has("rotavapor")) {
    expanded.add("rotary");
    expanded.add("evaporator");
  }
  if (expanded.has("flask") || expanded.has("flasks")) {
    expanded.add("flask");
    expanded.add("flasks");
  }
  if (expanded.has("maintenance") || expanded.has("service")) {
    expanded.add("service");
    expanded.add("due");
  }
  return [...expanded];
}

function recordText(record: DigitalTwinRecord) {
  return normalizeText(
    [
      record.name,
      record.kicker,
      record.indexCode,
      record.status,
      record.notes,
      record.primaryValue,
      record.secondaryValue,
      ...record.path,
    ].join(" "),
  );
}

export function searchSpatialRecords(project: Project, query: string, limit = 8) {
  const records = buildDigitalTwinIndex(project);
  const normalizedQuery = normalizeText(query);
  const terms = queryTerms(query);
  return records
    .map((record) => {
      const searchable = recordText(record);
      let score = searchable.includes(normalizedQuery) && normalizedQuery.length > 1 ? 80 : 0;
      for (const term of terms) {
        if (searchable.includes(term)) score += term.length > 5 ? 12 : 7;
      }
      if (
        score > 0 &&
        /where|find|location|cabinet|drawer|shelf/i.test(query) &&
        record.objectId
      )
        score += 4;
      if (score > 0 && /maintenance|service/i.test(query) && record.statusTone === "warning")
        score += 18;
      if (score > 0 && /missing|unassigned|no location/i.test(query) && !record.locationId)
        score += 18;
      return { record, score };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.record.name.localeCompare(right.record.name),
    )
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.record);
}

function evidenceFromRecord(record: DigitalTwinRecord): SpatialAssistantEvidence {
  return {
    id: record.id,
    kind: record.kind,
    name: record.name,
    roomId: record.roomId,
    roomName: record.roomName,
    objectId: record.objectId,
    locationId: record.locationId,
    path: record.path,
    indexCode: record.indexCode,
    status: record.status,
    primaryLabel: record.primaryLabel,
    primaryValue: record.primaryValue,
    secondaryLabel: record.secondaryLabel,
    secondaryValue: record.secondaryValue,
    notes: record.notes,
  };
}

function warningIsSpatial(warning: ValidationWarning) {
  return (
    warning.id.startsWith("outside-") ||
    warning.id.startsWith("below-floor-") ||
    warning.id.startsWith("above-ceiling-") ||
    warning.id.startsWith("overlap-") ||
    warning.id.startsWith("opening-")
  );
}

function containsBounds(container: ReturnType<typeof objectBounds>, item: ReturnType<typeof objectBounds>) {
  const tolerance = 20;
  return (
    item.left >= container.left - tolerance &&
    item.right <= container.right + tolerance &&
    item.top >= container.top - tolerance &&
    item.bottom <= container.bottom + tolerance
  );
}

function supportingObjects(room: Room, object: SceneObject) {
  if (object.position.z <= 20) return [];
  const footprint = objectBounds(object);
  return room.scene.objects.filter((candidate) => {
    if (
      candidate.id === object.id ||
      !candidate.visible ||
      ["wall", "door", "window", "label", "measurement"].includes(candidate.objectType)
    )
      return false;
    const top = candidate.position.z + candidate.dimensions.height;
    return Math.abs(top - object.position.z) <= 30 && containsBounds(objectBounds(candidate), footprint);
  });
}

function placementWarnings(room: Room, object: SceneObject) {
  const canonical = validatePlacement(room).filter(
    (warning) => warningIsSpatial(warning) && warning.objectIds.includes(object.id),
  );
  if (object.position.z > 20 && supportingObjects(room, object).length === 0) {
    canonical.push({
      id: `unsupported-${object.id}`,
      severity: "error",
      objectIds: [object.id],
      title: "Unsupported elevation",
      message: `${object.name} is raised ${Math.round(object.position.z)} mm but its footprint is not fully supported by an indexed surface.`,
    });
  }
  return canonical;
}

function candidateRoom(room: Room, objectId: string, position: SceneObject["position"]) {
  const clone = structuredClone(room);
  const candidate = clone.scene.objects.find((object) => object.id === objectId);
  if (!candidate) return null;
  candidate.position = { ...position };
  return { room: clone, object: candidate };
}

function candidatePoints(room: Room, object: SceneObject) {
  const points: Array<SceneObject["position"]> = [];
  const seen = new Set<string>();
  const push = (x: number, y: number, z = object.position.z) => {
    const key = `${Math.round(x)}:${Math.round(y)}:${Math.round(z)}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push({ x, y, z });
  };

  if (object.position.z > 20) {
    for (const support of room.scene.objects) {
      if (
        support.id === object.id ||
        !support.visible ||
        ["wall", "door", "window", "label", "measurement"].includes(support.objectType)
      )
        continue;
      const supportTop = support.position.z + support.dimensions.height;
      if (Math.abs(supportTop - object.position.z) > 30) continue;
      const bounds = objectBounds(support);
      const item = objectBounds({ ...object, position: { ...object.position, x: 0, y: 0 } });
      const extentX = Math.max(Math.abs(item.left), Math.abs(item.right));
      const extentY = Math.max(Math.abs(item.top), Math.abs(item.bottom));
      const minX = bounds.left + extentX + 25;
      const maxX = bounds.right - extentX - 25;
      const minY = bounds.top + extentY + 25;
      const maxY = bounds.bottom - extentY - 25;
      if (minX > maxX || minY > maxY) continue;
      push((minX + maxX) / 2, (minY + maxY) / 2, supportTop);
      for (let x = minX; x <= maxX; x += 250) {
        for (let y = minY; y <= maxY; y += 250) push(x, y, supportTop);
      }
      push(maxX, maxY, supportTop);
    }
  } else {
    const bounds = objectBounds({ ...object, position: { ...object.position, x: 0, y: 0 } });
    const extentX = Math.max(Math.abs(bounds.left), Math.abs(bounds.right));
    const extentY = Math.max(Math.abs(bounds.top), Math.abs(bounds.bottom));
    for (let x = extentX + 100; x <= room.width - extentX - 100; x += 300) {
      for (let y = extentY + 100; y <= room.depth - extentY - 100; y += 300) push(x, y, 0);
    }
  }

  return points.sort(
    (left, right) =>
      Math.hypot(left.x - object.position.x, left.y - object.position.y) -
      Math.hypot(right.x - object.position.x, right.y - object.position.y),
  );
}

export function suggestNearestValidPlacement(
  room: Room,
  objectId: string,
): PlacementSuggestion | null {
  const object = room.scene.objects.find((entry) => entry.id === objectId);
  if (!object) return null;
  for (const position of candidatePoints(room, object).slice(0, 600)) {
    if (
      Math.abs(position.x - object.position.x) < 1 &&
      Math.abs(position.y - object.position.y) < 1 &&
      Math.abs(position.z - object.position.z) < 1
    )
      continue;
    const candidate = candidateRoom(room, object.id, position);
    if (!candidate || placementWarnings(candidate.room, candidate.object).length) continue;
    return {
      objectId: object.id,
      roomId: room.id,
      position,
      distanceMm: Math.round(
        Math.hypot(position.x - object.position.x, position.y - object.position.y),
      ),
      rationale:
        object.position.z > 20
          ? "The full footprint is supported and the canonical room validator reports no boundary, height, or overlap conflict."
          : "The canonical room validator reports no boundary, height, or overlap conflict at this floor position.",
    };
  }
  return null;
}

export function reviewObjectPlacement(room: Room, objectId: string): PlacementReview | null {
  const object = room.scene.objects.find((entry) => entry.id === objectId);
  if (!object) return null;
  const warnings = placementWarnings(room, object);
  const equipment = room.scene.equipmentRecords.find((record) => record.objectId === object.id);
  const supports = supportingObjects(room, object);
  const facts = [
    `Indexed position: ${Math.round(object.position.x)} mm east, ${Math.round(object.position.y)} mm south, elevation ${Math.round(object.position.z)} mm.`,
  ];
  if (supports.length) facts.push(`Supported by ${supports.map((entry) => entry.name).join(", ")}.`);
  if (equipment) {
    facts.push(
      `Recorded services: power ${equipment.powerRequirements}; water ${equipment.waterRequirements}; gas ${equipment.gasRequirements}; drain ${equipment.drainRequired ? "required" : "not required"}; ventilation ${equipment.ventilationRequired ? "required" : "not required"}.`,
    );
  }
  const caveats = equipment
    ? [
        "The room index records equipment requirements, but it does not yet certify live utility capacity or regulatory clearance. Confirm those items before installation.",
      ]
    : ["No equipment service record is linked to this object, so utility suitability is unknown."];
  return {
    objectId: object.id,
    objectName: object.name,
    safe: warnings.length === 0,
    warnings,
    facts,
    caveats,
    suggestion: warnings.length ? suggestNearestValidPlacement(room, object.id) : null,
  };
}

function locationTrail(record: Pick<DigitalTwinRecord, "path">) {
  return record.path.length ? record.path.join(" / ") : "No physical location is assigned";
}

function inferIntent(question: string): SpatialAssistantAnswer["intent"] {
  if (/safe|place|placement|overlap|conflict|clearance/i.test(question)) return "placement";
  if (/maintenance|service|repair|inspection/i.test(question)) return "maintenance";
  if (/missing|unassigned|no location/i.test(question)) return "missing-location";
  if (/where|find|which cabinet|which drawer|which shelf/i.test(question)) return "locate";
  return "search";
}

export function answerSpatialQuestion(
  project: Project,
  question: string,
  context: { roomId?: string | null; objectId?: string | null } = {},
): SpatialAssistantAnswer {
  const intent = inferIntent(question);
  const records = searchSpatialRecords(project, question, 8);
  const preferredRoomId = context.roomId ?? records[0]?.roomId ?? project.activeRoomId;
  const room = project.rooms.find((entry) => entry.id === preferredRoomId) ?? project.rooms[0];
  const resolvedObjectId =
    context.objectId ?? records.find((record) => record.objectId)?.objectId ?? null;
  const placementReview =
    intent === "placement" && room && resolvedObjectId
      ? reviewObjectPlacement(room, resolvedObjectId)
      : null;

  let selected = records;
  if (/buchi|rotavapor|rotary evaporator/i.test(question) && /flask/i.test(question)) {
    const equipment = records.find(
      (record) => record.kind === "equipment" && /rotary evaporator|rotavapor/i.test(record.name),
    );
    const flasks = records.find(
      (record) => record.kind === "inventory" && /flask/i.test(record.name),
    );
    selected = [equipment, flasks].filter(
      (record): record is DigitalTwinRecord => Boolean(record),
    );
  } else if (intent === "maintenance") {
    selected = buildDigitalTwinIndex(project).filter(
      (record) => record.kind === "equipment" && record.statusTone === "warning",
    );
  } else if (intent === "missing-location") {
    selected = buildDigitalTwinIndex(project).filter(
      (record) => record.kind === "inventory" && !record.locationId,
    );
  } else if (intent === "placement" && resolvedObjectId && !selected.length) {
    const objectRecord = buildDigitalTwinIndex(project).find(
      (record) => record.objectId === resolvedObjectId && record.kind === "equipment",
    );
    selected = objectRecord ? [objectRecord] : [];
  }

  const evidence = selected.map(evidenceFromRecord);
  const facts = evidence.map(
    (record) => `${record.name}: ${locationTrail(record)} [${record.indexCode}].`,
  );
  const suggestions: string[] = [];
  const caveats: string[] = [];
  let summary = evidence.length
    ? `Found ${evidence.length} grounded ${evidence.length === 1 ? "record" : "records"}.`
    : "No stored record matches that request.";

  if (intent === "placement" && placementReview) {
    summary = placementReview.safe
      ? `${placementReview.objectName} has no deterministic placement conflict at its indexed position.`
      : `${placementReview.objectName} has ${placementReview.warnings.length} deterministic placement ${placementReview.warnings.length === 1 ? "conflict" : "conflicts"}.`;
    facts.push(...placementReview.facts);
    caveats.push(...placementReview.caveats);
    if (placementReview.suggestion) {
      const { position } = placementReview.suggestion;
      suggestions.push(
        `Suggested valid position: ${Math.round(position.x)} mm east, ${Math.round(position.y)} mm south, elevation ${Math.round(position.z)} mm. ${placementReview.suggestion.rationale}`,
      );
    }
  }
  if (!evidence.length) {
    caveats.push("LabSpace will not invent an inventory, equipment, owner, or maintenance record.");
  }

  return {
    mode: "grounded-local",
    intent,
    summary,
    facts,
    suggestions,
    caveats,
    evidence,
    focus: {
      roomId: evidence[0]?.roomId ?? room?.id ?? null,
      objectIds: [...new Set(evidence.flatMap((record) => (record.objectId ? [record.objectId] : [])))],
      locationIds: [
        ...new Set(evidence.flatMap((record) => (record.locationId ? [record.locationId] : []))),
      ],
    },
    placementReview,
  };
}
