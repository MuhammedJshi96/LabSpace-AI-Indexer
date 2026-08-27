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
