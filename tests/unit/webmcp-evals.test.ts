import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LABSPACE_WEBMCP_TOOL_NAMES } from "../../src/webmcp/register-labspace-tools";

interface WebMcpEvalCase {
  id: string;
  prompt: string;
  expectedTools: string[];
  forbiddenTools: string[];
  requiresHumanApproval: boolean;
  expectedOutcome: string;
}

interface WebMcpEvalFixture {
  version: number;
  toolSet: string[];
  cases: WebMcpEvalCase[];
}

function readEvalFixture(): WebMcpEvalFixture {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "docs/webmcp/evals/cases.json"), "utf8"),
  ) as WebMcpEvalFixture;
}

describe("LabSpace WebMCP evaluation fixture", () => {
  it("covers the published tool surface with bounded, unique cases", () => {
    const fixture = readEvalFixture();
    const knownTools = new Set(LABSPACE_WEBMCP_TOOL_NAMES);

    expect(fixture.version).toBe(1);
    expect([...fixture.toolSet].sort()).toEqual([...LABSPACE_WEBMCP_TOOL_NAMES].sort());
    expect(fixture.cases.length).toBeGreaterThanOrEqual(10);
    expect(new Set(fixture.cases.map((entry) => entry.id)).size).toBe(fixture.cases.length);

    for (const entry of fixture.cases) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(entry.prompt.trim().length).toBeGreaterThan(8);
      expect(entry.expectedOutcome.trim().length).toBeGreaterThan(20);
      expect(entry.expectedTools.length).toBeGreaterThan(0);
      for (const tool of [...entry.expectedTools, ...entry.forbiddenTools]) {
        expect(knownTools.has(tool as (typeof LABSPACE_WEBMCP_TOOL_NAMES)[number])).toBe(true);
      }
      expect(entry.expectedTools.filter((tool) => entry.forbiddenTools.includes(tool))).toEqual([]);
      if (
        entry.expectedTools.includes("labspace_stage_object_move") ||
        entry.expectedTools.includes("labspace_stage_resize") ||
        (entry.expectedTools.includes("labspace_stage_room_plan") &&
          !entry.expectedTools.includes("labspace_create_room"))
      ) {
        expect(entry.requiresHumanApproval).toBe(true);
      }
    }
  });

  it("keeps unsafe and structural requests out of the staging boundary", () => {
    const fixture = readEvalFixture();
    for (const id of ["refuse-unsafe-overlap", "refuse-structural-move"]) {
      const entry = fixture.cases.find((candidate) => candidate.id === id)!;
      expect(entry.expectedTools).toContain("labspace_validate_object_move");
      expect(entry.forbiddenTools).toContain("labspace_stage_object_move");
    }
  });
});
