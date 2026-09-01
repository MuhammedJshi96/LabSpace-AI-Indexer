import { create } from "zustand";
import { agentActivityActions } from "./agent-activity-store";

export type WebMcpExecutionMode = "reviewed" | "fast-draft";

export type WebMcpMutationKind =
  | "create-room"
  | "initial-room-blueprint"
  | "existing-room-layout"
  | "existing-object-move"
  | "existing-object-resize"
  | "inventory-records"
  | "stock-change"
  | "destructive-change";

export type WebMcpExecutionDecision = {
  mode: WebMcpExecutionMode;
  disposition: "review-required" | "fast-applied";
  reason: string;
  undoAvailable: boolean;
};

type DecisionContext = {
  valid?: boolean;
  pristine?: boolean;
  complete?: boolean;
};

type WebMcpExecutionPolicyState = {
  mode: WebMcpExecutionMode;
  setModeFromHumanUi: (mode: WebMcpExecutionMode) => void;
};

const FAST_DRAFT_ALLOWLIST = new Set<WebMcpMutationKind>(["create-room", "initial-room-blueprint"]);

export const useWebMcpExecutionPolicyStore = create<WebMcpExecutionPolicyState>((set, get) => ({
  // Deliberately volatile: every new LabSpace application session starts behind review.
  mode: "reviewed",
  setModeFromHumanUi: (mode) => {
    if (mode === get().mode) return;
    set({ mode });
    agentActivityActions.record({
      actor: "Human",
      action: mode === "reviewed" ? "Reviewed mode enabled" : "Fast Draft authorized",
      subject:
        mode === "reviewed"
          ? "Project mutations pause for explicit approval"
          : "Only validated additive room drafts may apply automatically",
      status: mode === "reviewed" ? "approved" : "valid",
      evidence:
        mode === "reviewed"
          ? "Human-controlled session boundary"
          : "Session only · existing placements, inventory, stock, and destructive edits remain reviewed",
    });
  },
}));

export function getWebMcpExecutionMode() {
  return useWebMcpExecutionPolicyStore.getState().mode;
}

export function decideWebMcpMutation(
  kind: WebMcpMutationKind,
  context: DecisionContext = {},
): WebMcpExecutionDecision {
  const mode = getWebMcpExecutionMode();
  if (context.valid === false) {
    return {
      mode,
      disposition: "review-required",
      reason: "Validation did not pass; automatic application is blocked.",
      undoAvailable: false,
    };
  }
  if (mode === "reviewed") {
    return {
      mode,
      disposition: "review-required",
      reason: "Reviewed mode requires explicit human approval before project mutation.",
      undoAvailable: false,
    };
  }
  if (!FAST_DRAFT_ALLOWLIST.has(kind)) {
    return {
      mode,
      disposition: "review-required",
      reason: "Fast Draft escalated this change because it affects existing data or placement.",
      undoAvailable: false,
    };
  }
  if (kind === "initial-room-blueprint" && context.pristine !== true) {
    return {
      mode,
      disposition: "review-required",
      reason: "Fast Draft applies blueprints only to a pristine WebMCP-created room.",
      undoAvailable: false,
    };
  }
  if (kind === "initial-room-blueprint" && context.complete !== true) {
    return {
      mode,
      disposition: "review-required",
      reason: "Fast Draft escalated an incomplete blueprint for human review.",
      undoAvailable: false,
    };
  }
  return {
    mode,
    disposition: "fast-applied",
    reason:
      kind === "initial-room-blueprint"
        ? "Human-authorized Fast Draft applied a validated additive blueprint with Undo."
        : "Human-authorized Fast Draft applied validated additive room creation.",
    undoAvailable: kind === "initial-room-blueprint",
  };
}

export function executionDecisionForTool(toolName: string): WebMcpExecutionDecision | null {
  const kind: WebMcpMutationKind | null =
    toolName === "labspace_stage_object_move"
      ? "existing-object-move"
      : toolName === "labspace_stage_resize"
        ? "existing-object-resize"
        : toolName === "labspace_add_inventory" || toolName === "labspace_stage_inventory_plan"
          ? "inventory-records"
          : null;
  return kind ? decideWebMcpMutation(kind, { valid: true }) : null;
}

export function resetWebMcpExecutionPolicyForTests() {
  useWebMcpExecutionPolicyStore.setState({ mode: "reviewed" });
}
