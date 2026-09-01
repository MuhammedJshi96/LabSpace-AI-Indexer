import { create } from "zustand";

const ACTIVITY_PAGE_SIZE = 30;
const ACTIVITY_STORAGE_KEY = "labspace-agent-activity-v2";
const MAX_SUBJECT_LENGTH = 140;
const MAX_EVIDENCE_LENGTH = 220;
const MAX_TOOL_PAYLOAD_LENGTH = 420;

export type AgentActivityActor = "Agent" | "WebMCP" | "Human" | "LabSpace";
export type AgentActivityStatus =
  | "read"
  | "found"
  | "focused"
  | "valid"
  | "blocked"
  | "pending"
  | "approved"
  | "rejected"
  | "committed"
  | "error";

export type AgentActivityEvent = {
  id: string;
  createdAt: string;
  actor: AgentActivityActor;
  action: string;
  subject: string;
  status: AgentActivityStatus;
  evidence: string | null;
  toolName: string | null;
  request: string | null;
  response: string | null;
  correlationId: string | null;
  roomId: string | null;
};

type NewAgentActivityEvent = Omit<
  AgentActivityEvent,
  "id" | "createdAt" | "toolName" | "request" | "response" | "correlationId" | "roomId"
> &
  Partial<
    Pick<AgentActivityEvent, "toolName" | "request" | "response" | "correlationId" | "roomId">
  >;

export type WebMCPBridgeStatus = "unavailable" | "registering" | "ready" | "error";

type AgentActivityState = {
  events: AgentActivityEvent[];
  open: boolean;
  bridgeStatus: WebMCPBridgeStatus;
  registeredTools: string[];
  bridgeMessage: string | null;
  visibleCount: number;
  unreadCount: number;
  record: (event: NewAgentActivityEvent) => void;
  setOpen: (open: boolean) => void;
  setBridgeState: (
    status: WebMCPBridgeStatus,
    registeredTools?: string[],
    message?: string | null,
  ) => void;
  clear: () => void;
  loadEarlier: () => void;
};

function compact(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, maximum - 1)}…`;
}

function safeEvidence(value: string | null | undefined) {
  if (!value) return null;
  const withoutLocalPaths = value
    .replace(/[A-Za-z]:\\[^\s]+/g, "[local path hidden]")
    .replace(/(?:file:\/\/|\/Users\/|\/home\/)[^\s]+/gi, "[local path hidden]");
  return compact(withoutLocalPaths, MAX_EVIDENCE_LENGTH);
}

function safeToolPayload(value: string | null | undefined) {
  if (!value) return null;
  const withoutLocalPaths = value
    .replace(/[A-Za-z]:\\\\[^\s"}]+/g, "[local path hidden]")
    .replace(/(?:file:\/\/|\/Users\/|\/home\/)[^\s"}]+/gi, "[local path hidden]");
  return compact(withoutLocalPaths, MAX_TOOL_PAYLOAD_LENGTH);
}

function boundedJson(value: unknown) {
  try {
    return safeToolPayload(JSON.stringify(value));
  } catch {
    return "[structured value unavailable]";
  }
}

function loadStoredEvents(): AgentActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVITY_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (event): event is AgentActivityEvent =>
          event &&
          typeof event === "object" &&
          typeof event.id === "string" &&
          typeof event.createdAt === "string" &&
          typeof event.action === "string",
      )
      .map((event) => ({ ...event, correlationId: event.correlationId ?? null, roomId: event.roomId ?? null }));
  } catch {
    return [];
  }
}

function persistEvents(events: AgentActivityEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Activity remains complete for this session if the browser's local quota is unavailable.
  }
}

function activityCorrelation(input: unknown, result: unknown) {
  const request = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const response = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const value =
    request.planId ??
    response.planId ??
    response.stageId ??
    request.recordId ??
    response.recordId ??
    response.roomId;
  return typeof value === "string" && value ? value : null;
}

function csvCell(value: string | null) {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

export function serializeAgentActivityHistory(
  events: AgentActivityEvent[],
  format: "json" | "csv",
) {
  if (format === "json") return JSON.stringify({ exportedAt: new Date().toISOString(), events }, null, 2);
  const header = [
    "createdAt",
    "actor",
    "status",
    "action",
    "subject",
    "toolName",
    "correlationId",
    "roomId",
    "evidence",
    "request",
    "response",
  ];
  return [
    header.map(csvCell).join(","),
    ...events.map((event) =>
      [
        event.createdAt,
        event.actor,
        event.status,
        event.action,
        event.subject,
        event.toolName,
        event.correlationId,
        event.roomId,
        event.evidence,
        event.request,
        event.response,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
}

export function downloadAgentActivityHistory(
  events: AgentActivityEvent[],
  format: "json" | "csv",
) {
  const blob = new Blob([serializeAgentActivityHistory(events, format)], {
    type: format === "json" ? "application/json" : "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `labspace-agent-activity-${new Date().toISOString().slice(0, 10)}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const storedEvents = loadStoredEvents();

export const useAgentActivityStore = create<AgentActivityState>((set) => ({
  events: storedEvents,
  open: false,
  bridgeStatus: "unavailable",
  registeredTools: [],
  bridgeMessage: null,
  visibleCount: ACTIVITY_PAGE_SIZE,
  unreadCount: 0,
  record: (event) =>
    set((state) => {
      const events = [
        {
          ...event,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          action: compact(event.action, 60),
          subject: compact(event.subject, MAX_SUBJECT_LENGTH),
          evidence: safeEvidence(event.evidence),
          toolName: event.toolName ? compact(event.toolName, 60) : null,
          request: safeToolPayload(event.request),
          response: safeToolPayload(event.response),
          correlationId: event.correlationId ? compact(event.correlationId, 200) : null,
          roomId: event.roomId ? compact(event.roomId, 120) : null,
        },
        ...state.events,
      ];
      persistEvents(events);
      return {
        events,
        unreadCount: state.open ? state.unreadCount : state.unreadCount + 1,
      };
    }),
  setOpen: (open) =>
    set((state) => ({
      open,
      unreadCount: open ? 0 : state.unreadCount,
      visibleCount: open ? ACTIVITY_PAGE_SIZE : state.visibleCount,
    })),
  setBridgeState: (bridgeStatus, registeredTools = [], bridgeMessage = null) =>
    set({ bridgeStatus, registeredTools: [...registeredTools], bridgeMessage }),
  clear: () => {
    persistEvents([]);
    set({ events: [], visibleCount: ACTIVITY_PAGE_SIZE, unreadCount: 0 });
  },
  loadEarlier: () =>
    set((state) => ({
      visibleCount: Math.min(state.events.length, state.visibleCount + ACTIVITY_PAGE_SIZE),
    })),
}));

export const agentActivityActions = {
  record: (event: NewAgentActivityEvent) => useAgentActivityStore.getState().record(event),
  setBridgeState: (
    status: WebMCPBridgeStatus,
    registeredTools?: string[],
    message?: string | null,
  ) => useAgentActivityStore.getState().setBridgeState(status, registeredTools, message),
};

export function recordWebMCPToolSuccess(
  toolName: string,
  action: string,
  subject: string,
  status: AgentActivityStatus,
  input: unknown,
  result: unknown,
) {
  agentActivityActions.record({
    actor: "WebMCP",
    action,
    subject,
    status,
    evidence: "Structured tool call completed against canonical LabSpace state.",
    toolName,
    request: boundedJson(input),
    response: boundedJson(result),
    correlationId: activityCorrelation(input, result),
    roomId:
      result && typeof result === "object" && typeof (result as Record<string, unknown>).roomId === "string"
        ? String((result as Record<string, unknown>).roomId)
        : null,
  });
}

export function recordControlledToolError(
  action: string,
  error: unknown,
  toolName?: string,
  input?: unknown,
) {
  const message = error instanceof Error ? error.message : "Tool request failed.";
  agentActivityActions.record({
    actor: toolName ? "WebMCP" : "LabSpace",
    action,
    subject: "Tool request failed",
    status: "error",
    evidence: message,
    toolName,
    request: boundedJson(input),
    response: boundedJson({ error: message }),
  });
}

export { ACTIVITY_PAGE_SIZE, MAX_TOOL_PAYLOAD_LENGTH };
