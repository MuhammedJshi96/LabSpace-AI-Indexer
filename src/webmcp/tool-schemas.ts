export const emptyObjectSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export const searchRecordsSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      description:
        "Words, names, identifiers, owners, notes, rooms, or storage-path terms to find.",
    },
    scope: {
      type: "string",
      enum: ["project", "room"],
      default: "project",
      description: "Search the whole project or only the active room.",
    },
    kinds: {
      type: "array",
      items: { type: "string", enum: ["inventory", "equipment", "location"] },
      uniqueItems: true,
      description: "Optional record kinds to include.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 12,
      default: 8,
      description: "Maximum compact results to return, from 1 to 12.",
    },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

export const inspectRecordSchema = {
  type: "object",
  properties: {
    recordId: {
      type: "string",
      minLength: 1,
      maxLength: 300,
      description: "Exact canonical record ID returned by labspace_search_records.",
    },
  },
  required: ["recordId"],
  additionalProperties: false,
} as const;

export const focusRecordSchema = inspectRecordSchema;

export const validateObjectMoveSchema = {
  type: "object",
  properties: {
    objectId: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "Canonical LabSpace scene-object ID to evaluate.",
    },
    target: {
      type: "object",
      properties: {
        xMm: {
          type: "number",
          minimum: -100000,
          maximum: 100000,
          description: "Proposed object-center X position in millimetres.",
        },
        yMm: {
          type: "number",
          minimum: -100000,
          maximum: 100000,
          description: "Proposed object-center Y position in millimetres.",
        },
      },
      required: ["xMm", "yMm"],
      additionalProperties: false,
    },
    rotationDeg: {
      type: "number",
      minimum: -360,
      maximum: 360,
      description: "Optional proposed Z-axis rotation in degrees.",
    },
  },
  required: ["objectId", "target"],
  additionalProperties: false,
} as const;

export const stageObjectMoveSchema = validateObjectMoveSchema;

export const recommendObjectPlacementsSchema = {
  type: "object",
  properties: {
    objectId: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "Canonical movable LabSpace scene-object ID to place.",
    },
    preferredTarget: {
      type: "object",
      properties: {
        xMm: {
          type: "number",
          minimum: -100000,
          maximum: 100000,
          description: "Preferred center X position in millimetres.",
        },
        yMm: {
          type: "number",
          minimum: -100000,
          maximum: 100000,
          description: "Preferred center Y position in millimetres.",
        },
      },
      required: ["xMm", "yMm"],
      additionalProperties: false,
    },
    rotationsDeg: {
      type: "array",
      items: { type: "number", minimum: -360, maximum: 360 },
      minItems: 1,
      maxItems: 4,
      uniqueItems: true,
      description: "Optional Z-axis rotations to evaluate. Defaults to current and quarter-turn.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 5,
      default: 3,
      description: "Number of diverse ranked candidates to return, from 1 to 5.",
    },
  },
  required: ["objectId"],
  additionalProperties: false,
} as const;
