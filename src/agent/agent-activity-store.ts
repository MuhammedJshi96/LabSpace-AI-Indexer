import { create } from "zustand";

const MAX_ACTIVITY_EVENTS = 30;
const MAX_SUBJECT_LENGTH = 140;
const MAX_EVIDENCE_LENGTH = 220;

export type AgentActivityActor = "Agent" | "Human" | "LabSpace";
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
};

type NewAgentActivityEvent = Omit<AgentActivityEvent, "id" | "createdAt">;

type AgentActivityState = {
  events: AgentActivityEvent[];
  open: boolean;
  record: (event: NewAgentActivityEvent) => void;
  setOpen: (open: boolean) => void;
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

export const useAgentActivityStore = create<AgentActivityState>((set) => ({
  events: [],
  open: false,
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
        },
        ...state.events,
      ].slice(0, MAX_ACTIVITY_EVENTS),
    })),
  setOpen: (open) => set({ open }),
  clear: () => set({ events: [] }),
}));

export const agentActivityActions = {
  record: (event: NewAgentActivityEvent) => useAgentActivityStore.getState().record(event),
};

export function recordControlledToolError(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Tool request failed.";
  agentActivityActions.record({
    actor: "LabSpace",
    action,
    subject: "Tool request failed",
    status: "error",
    evidence: message,
  });
}

export { MAX_ACTIVITY_EVENTS };
