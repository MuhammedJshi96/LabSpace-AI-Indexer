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

export const searchAssetsSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      description: "Asset names, categories, functions, or catalog tags to find.",
    },
    categories: {
      type: "array",
      items: {
        type: "string",
        enum: ["Furniture", "Storage", "Laboratory equipment", "Safety"],
      },
      minItems: 1,
      uniqueItems: true,
      description: "Optional room-planning catalog categories to include.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 12,
      default: 8,
      description: "Maximum compact catalog results to return.",
    },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

export const planRoomLayoutSchema = {
  type: "object",
  properties: {
    brief: {
      type: "string",
      minLength: 1,
      maxLength: 240,
      description: "Short human-readable purpose for the proposed room layout.",
    },
    assets: {
      type: "array",
      minItems: 0,
      maxItems: 16,
      items: {
        type: "object",
        properties: {
          assetId: {
            type: "string",
            minLength: 1,
            maxLength: 120,
            description: "Exact catalog ID returned by labspace_search_assets.",
          },
          quantity: { type: "integer", minimum: 1, maximum: 4 },
          placement: {
            type: "string",
            enum: ["auto", "perimeter", "island", "open", "surface"],
            default: "auto",
            description:
              "Preferred deterministic placement pattern. Surface places bench-connected equipment on a compatible worktop.",
          },
          position: {
            type: "object",
            properties: {
              xMm: { type: "number", minimum: -20000, maximum: 40000 },
              yMm: { type: "number", minimum: -20000, maximum: 40000 },
            },
            required: ["xMm", "yMm"],
            additionalProperties: false,
            description: "Optional exact object centre in room millimetres; requires quantity 1.",
          },
          rotationDeg: {
            type: "number",
            minimum: -360,
            maximum: 360,
            description: "Optional exact Z-axis rotation in degrees.",
          },
          elevationMm: {
            type: "number",
            minimum: 0,
            maximum: 6000,
            description:
              "Optional raised-from-floor elevation. Bench equipment is validated against the supporting worktop elevation.",
          },
        },
        required: ["assetId", "quantity"],
        additionalProperties: false,
      },
      description:
        "Catalog assets to arrange; may be empty only when roomShell builds the enclosure.",
    },
    aisleMm: {
      type: "integer",
      minimum: 600,
      maximum: 2000,
      default: 900,
      description: "Preferred planning aisle around island/open assets in millimetres.",
    },
    roomShell: {
      type: "object",
      properties: {
        widthMm: {
          type: "integer",
          minimum: 3000,
          maximum: 20000,
          description: "Inside room width in millimetres for a new rectangular wall shell.",
        },
        depthMm: {
          type: "integer",
          minimum: 3000,
          maximum: 20000,
          description: "Inside room depth in millimetres for a new rectangular wall shell.",
        },
        vertices: {
          type: "array",
          minItems: 3,
          maxItems: 17,
          items: {
            type: "object",
            properties: {
              xMm: { type: "integer", minimum: 0, maximum: 20000 },
              yMm: { type: "integer", minimum: 0, maximum: 20000 },
            },
            required: ["xMm", "yMm"],
            additionalProperties: false,
          },
          description:
            "Three to sixteen ordered corners for a closed non-crossing room. LabSpace closes the final corner automatically.",
        },
        wallHeightMm: { type: "integer", minimum: 2400, maximum: 6000, default: 3000 },
        wallThicknessMm: { type: "integer", minimum: 100, maximum: 300, default: 150 },
      },
      oneOf: [{ required: ["widthMm", "depthMm"] }, { required: ["vertices"] }],
      additionalProperties: false,
      description:
        "Closed rectangular or arbitrary polygon shell for a blank room. Existing walls are never replaced automatically.",
    },
  },
  required: ["assets"],
  additionalProperties: false,
} as const;

export const stageRoomLayoutSchema = {
  type: "object",
  properties: {
    planId: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "Exact plan ID returned by labspace_plan_room.",
    },
  },
  required: ["planId"],
  additionalProperties: false,
} as const;

export const listInventoryLocationsSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      description: "Optional storage name, code, room, or path query.",
    },
    roomCode: {
      type: "string",
      minLength: 1,
      maxLength: 40,
      description: "Optional exact editable room code such as DEMO-01.",
    },
    limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
  },
  additionalProperties: false,
} as const;

export const planInventorySchema = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          roomCode: {
            type: "string",
            minLength: 1,
            maxLength: 40,
            description: "Exact editable room code returned by LabSpace context or location search.",
          },
          name: { type: "string", minLength: 1, maxLength: 120 },
          quantity: { type: "number", minimum: 0 },
          unit: { type: "string", minLength: 1, maxLength: 40 },
          storageLocationId: {
            type: "string",
            minLength: 1,
            maxLength: 120,
            description: "Exact locationId returned by labspace_inventory_locations.",
          },
          owner: { type: "string", maxLength: 120 },
          notes: { type: "string", maxLength: 500 },
          expiryDate: {
            type: ["string", "null"],
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description: "Optional ISO calendar date YYYY-MM-DD.",
          },
        },
        required: ["roomCode", "name", "quantity", "unit"],
        additionalProperties: false,
      },
    },
  },
  required: ["entries"],
  additionalProperties: false,
} as const;

export const stageInventoryPlanSchema = {
  type: "object",
  properties: {
    planId: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "Exact plan ID returned by labspace_plan_inventory.",
    },
  },
  required: ["planId"],
  additionalProperties: false,
} as const;
