import { describe, expect, it } from "vitest";
import { DEMO_MISSIONS } from "../../src/agent/judge-missions";

describe("natural-language judge missions", () => {
  it("keeps typed and spoken requests concise without tool scripts or hidden setup", () => {
    for (const mission of DEMO_MISSIONS) {
      for (const prompt of [mission.prompt, mission.voicePrompt]) {
        expect(prompt).toMatch(/^Use the connected LabSpace WebMCP tools only\./);
        expect(prompt).not.toMatch(/labspace_|requiresHumanApproval|autoCommitted|wallIndex/);
        expect(prompt.split(/\s+/).length).toBeLessThanOrEqual(110);
        expect(prompt).toContain("my approval");
      }
    }
  });

  it("preserves the complete office and continuous build request in both variants", () => {
    const build = DEMO_MISSIONS[0];
    for (const prompt of [build.prompt, build.voicePrompt]) {
      for (const fact of [
        "Researcher Office",
        "R-003",
        "this lab",
        "7.6 by 5",
        "38 square metres",
        "inward-opening single door",
        "bottom wall",
        "wide three-panel window",
        "top and left walls",
        "three office desks",
        "office chair",
        "one locker",
        "one fire extinguisher",
        "one waste bin",
        "Build, furnish and check",
        "in one go; pause only if LabSpace asks for my approval",
      ])
        expect(prompt).toContain(fact);
      expect(prompt).toMatch(/rectang/);
    }
  });

  it("preserves stock facts, both distinct dates, and approval before saving", () => {
    for (const prompt of [DEMO_MISSIONS[1].prompt, DEMO_MISSIONS[1].voicePrompt]) {
      expect(prompt).toMatch(/alpha-glucosidase enzyme, (2|two) bottles/i);
      expect(prompt).toMatch(/lipase enzyme, (1|one) bottle/i);
      expect(prompt).toMatch(/6 October 2026|October sixth 2026/);
      expect(prompt).toMatch(/16 October 2026|October sixteenth 2026/);
      expect(prompt).toContain("R-002");
      expect(prompt).toContain("Leave storage and other unspecified details unassigned");
      expect(prompt).toContain("my approval before saving");
    }
  });

  it("keeps the exact checklist, separate stock check, native review and workspace handoff", () => {
    for (const prompt of [DEMO_MISSIONS[2].prompt, DEMO_MISSIONS[2].voicePrompt]) {
      for (const fact of [
        "approved DPPH checklist across this lab",
        "DPPH reagent",
        "100 and 200 microlitre pipette tips",
        "laboratory pipette holder",
        "automated microplate reader",
        "Do not add solvents or other requirements",
        "chloroform",
        "separately",
        "missing or uncertain",
        "real work surface in R-002",
        "in-app Review collection dialog",
        "exact items and final workspace",
        "wait for my approval there",
        "finish at that workspace",
        "experiment protocol or stock deduction",
      ])
        expect(prompt).toContain(fact);
      expect(prompt).not.toMatch(/methanol/i);
    }
  });
});
