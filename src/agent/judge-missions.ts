// Connection is a separate, one-time step. Copy exactly the request shown on
// each card; detailed tool sequencing belongs in the registered descriptions.
const connectedRequest = (request: string) =>
  `Use the connected LabSpace WebMCP tools only. ${request}`;

export const DEMO_MISSIONS = [
  {
    id: "build-r003",
    step: "01 · Build",
    mode: "Fast Draft · one prompt",
    title: "Create R-003 from one request",
    outcome: "38 m² office · three desks with chairs · checked layout",
    prompt: connectedRequest(
      "In this lab, build Researcher Office, R-003: a 7.6 by 5 metre rectangular room (38 square metres). Put one inward-opening single door in the centre of the bottom wall and one wide three-panel window centred on each of the top and left walls. Add three office desks, each with a matching office chair, one locker, one fire extinguisher and one waste bin. Build, furnish and check the layout in one go; pause only if LabSpace asks for my approval.",
    ),
    voicePrompt: connectedRequest(
      "Build Researcher Office, R-003, in this lab: a rectangle, 7.6 by 5 metres, 38 square metres. Centre one inward-opening single door on the bottom wall, and one wide three-panel window on each of the top and left walls. Add three office desks with a matching office chair each, one locker, one fire extinguisher and one waste bin. Build, furnish and check it in one go; pause only if LabSpace asks for my approval.",
    ),
  },
  {
    id: "stock-enzymes",
    step: "02 · Stock",
    mode: "Stage + approve",
    title: "Stage two enzyme records",
    outcome: "Two stock entries · exact expiry dates · your approval",
    prompt: connectedRequest(
      "Add to R-002: Alpha-glucosidase enzyme, 2 bottles, expiring 6 October 2026; and Lipase enzyme, 1 bottle, expiring 16 October 2026. Leave storage and other unspecified details unassigned. Show both entries in LabSpace for my approval before saving.",
    ),
    voicePrompt: connectedRequest(
      "Add two inventory entries to R-002: alpha-glucosidase enzyme, two bottles, expiring October sixth 2026; and lipase enzyme, one bottle, expiring October sixteenth 2026. Leave storage and other unspecified details unassigned. Show both in LabSpace for my approval before saving.",
    ),
  },
  {
    id: "find-dpph-work",
    step: "03 · Find the work",
    mode: "Search + assess",
    title: "Ground a DPPH collection",
    outcome: "Find the checklist · review together · finish at a workbench",
    prompt: connectedRequest(
      "Find my approved DPPH checklist across this lab: DPPH reagent, 100 and 200 microlitre pipette tips, a laboratory pipette holder and an automated microplate reader. Do not add solvents or other requirements. Check chloroform availability separately. Show missing or uncertain matches and recommend a real work surface in R-002. Open the in-app Review collection dialog for the exact items and final workspace, and wait for my approval there. Then let me follow the items one by one and finish at that workspace. This is a collection plan, not an experiment protocol or stock deduction.",
    ),
    voicePrompt: connectedRequest(
      "Find my approved DPPH checklist across this lab: DPPH reagent, 100 and 200 microlitre pipette tips, a laboratory pipette holder and an automated microplate reader. Do not add solvents or other requirements. Check chloroform separately and show anything missing or uncertain. Recommend a real work surface in R-002. Open the in-app Review collection dialog for the exact items and final workspace, and wait for my approval there. Then guide me through the items and finish at that workspace. This is not an experiment protocol or stock deduction.",
    ),
  },
] as const;
