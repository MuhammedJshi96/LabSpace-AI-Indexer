import { afterEach, describe, expect, it } from "vitest";
import {
  decideWebMcpMutation,
  resetWebMcpExecutionPolicyForTests,
  useWebMcpExecutionPolicyStore,
} from "../../src/agent/webmcp-execution-policy";
import { createRoomSchema, stageRoomLayoutSchema } from "../../src/webmcp/tool-schemas";

afterEach(() => resetWebMcpExecutionPolicyForTests());

describe("WebMCP execution policy", () => {
  it("starts in Reviewed mode and pauses every project mutation", () => {
    expect(useWebMcpExecutionPolicyStore.getState().mode).toBe("reviewed");
    expect(decideWebMcpMutation("create-room", { valid: true })).toMatchObject({
      mode: "reviewed",
      disposition: "review-required",
      undoAvailable: false,
    });
    expect(
      decideWebMcpMutation("initial-room-blueprint", {
        valid: true,
        pristine: true,
        complete: true,
      }),
    ).toMatchObject({ disposition: "review-required" });
  });

  it("allows only validated additive room drafts in human-authorized Fast Draft", () => {
    useWebMcpExecutionPolicyStore.getState().setModeFromHumanUi("fast-draft");

    expect(decideWebMcpMutation("create-room", { valid: true })).toMatchObject({
      disposition: "fast-applied",
      undoAvailable: false,
    });
    expect(
      decideWebMcpMutation("initial-room-blueprint", {
        valid: true,
        pristine: true,
        complete: true,
      }),
    ).toMatchObject({ disposition: "fast-applied", undoAvailable: true });
  });

  it.each([
    "existing-room-layout",
    "existing-object-move",
    "existing-object-resize",
    "inventory-records",
    "stock-change",
    "destructive-change",
  ] as const)("escalates %s to human review in Fast Draft", (kind) => {
    useWebMcpExecutionPolicyStore.getState().setModeFromHumanUi("fast-draft");
    expect(decideWebMcpMutation(kind, { valid: true })).toMatchObject({
      mode: "fast-draft",
      disposition: "review-required",
    });
  });

  it("escalates incomplete, non-pristine, and invalid drafts", () => {
    useWebMcpExecutionPolicyStore.getState().setModeFromHumanUi("fast-draft");
    expect(
      decideWebMcpMutation("initial-room-blueprint", {
        valid: true,
        pristine: true,
        complete: false,
      }),
    ).toMatchObject({ disposition: "review-required" });
    expect(
      decideWebMcpMutation("initial-room-blueprint", {
        valid: true,
        pristine: false,
        complete: true,
      }),
    ).toMatchObject({ disposition: "review-required" });
    expect(decideWebMcpMutation("create-room", { valid: false })).toMatchObject({
      disposition: "review-required",
    });
  });

  it("does not expose execution mode as an agent-controlled tool argument", () => {
    const schemas = JSON.stringify([createRoomSchema, stageRoomLayoutSchema]).toLowerCase();
    expect(schemas).not.toContain("executionmode");
    expect(schemas).not.toContain("fastdraft");
    expect(schemas).not.toContain('"fast"');
  });
});
