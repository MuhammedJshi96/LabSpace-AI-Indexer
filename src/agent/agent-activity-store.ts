import { create } from "zustand";

const MAX_ACTIVITY_EVENTS = 30;
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
};

type NewAgentActivityEvent = Omit<
  AgentActivityEvent,
  "id" | "createdAt" | "toolName" | "request" | "response"
> &
  Partial<Pick<AgentActivityEvent, "toolName" | "request" | "response">>;

export type WebMCPBridgeStatus = "unavailable" | "registering" | "ready" | "error";

type AgentActivityState = {
  events: AgentActivityEvent[];
  open: boolean;
  bridgeStatus: WebMCPBridgeStatus;
  registeredTools: string[];
  bridgeMessage: string | null;
  record: (event: NewAgentActivityEvent) => void;
  setOpen: (open: boolean) => void;
  setBridgeState: (
    status: WebMCPBridgeStatus,
    registeredTools?: string[],
    message?: string | null,
  ) => void;
  clear: () => void;
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

export const useAgentActivityStore = create<AgentActivityState>((set) => ({
  events: [],
  open: false,
  bridgeStatus: "unavailable",
  registeredTools: [],
  bridgeMessage: null,
  record: (event) =>
    set((state) => ({
      events: [
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
        },
        ...state.events,
      ].slice(0, MAX_ACTIVITY_EVENTS),
    })),
  setOpen: (open) => set({ open }),
  setBridgeState: (bridgeStatus, registeredTools = [], bridgeMessage = null) =>
    set({ bridgeStatus, registeredTools: [...registeredTools], bridgeMessage }),
  clear: () => set({ events: [] }),
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

export { MAX_ACTIVITY_EVENTS, MAX_TOOL_PAYLOAD_LENGTH };
