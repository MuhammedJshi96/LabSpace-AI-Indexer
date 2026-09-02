# LabSpace Atlas — final WebMCP judge guide

**WebMCP for the physical laboratory.** The final demonstration is one connected story across the
public `LAB-D-00` workspace. R-001 and R-002 are authored evidence; R-003 is created live.

## Open

- Live: [https://labspace-agent-twin.onrender.com](https://labspace-agent-twin.onrender.com).
- Local fallback: `npm ci`, `npm run dev`, then open `http://127.0.0.1:3004/`.
- Use a WebMCP-capable browser-agent conversation. LabSpace does not contain a second chatbot.
- Confirm the workspace shows `LAB-D-00`, R-001 Analytical Chemistry Lab and R-002 Biological
  Assay room. A fresh judge session should not contain R-003 yet.

The public service stores an independent browser workspace. Wait for **Saved in this browser**
before navigating away. Existing judge workspaces are not overwritten by deployments; JSON export
remains the portable backup.

## Inspector and human boundary

Open **WebMCP** in the product header.

1. Confirm **24 tools ready**.
2. Confirm **Reviewed** is selected. Every mutation stops for human approval.
3. Use **Fast Draft** only for the first room-building segment if the presenter wants the complete,
   validated additive R-003 blueprint to apply without a second approval. The mode is session-only,
   visible, and cannot be selected by a tool argument.
4. Choose a prompt's **Copy + show workspace** or **Voice-ready** action. The Inspector closes so
   the normal 2D/3D result remains visible.
5. Reopen **Evidence** after each segment to show exact tool names and bounded input/result records.

The copied prompts require `labspace_*` WebMCP tools and explicitly prohibit silent fallback to
clicks, drags or computer control. If the tools are unavailable, the browser agent must stop.

## Final three-part demonstration

### 1. Build R-003

Use the Inspector's **Create R-003 from one request** prompt. It asks the agent to:

- create Researcher Office `R-003` in the currently opened `LAB-D-00` laboratory;
- construct a 7,600 × 5,000 mm rectangular shell: exactly 38 m² and four connected walls;
- host one centered inward single door on wall 1;
- host one wide three-panel window on wall 3 and another on wall 4;
- place three office desks, pair one chair to each desk, and add one locker, fire extinguisher and
  waste bin;
- stage or Fast-Draft the blueprint, then run `labspace_audit_room`.

Observed acceptance result: 4 walls, 3 hosted openings and 9 movable/furnishing assets. All twelve
requested catalog assets place successfully; every chair reports workstation pairing.

### 2. Stage exact inventory

Use **Stage two enzyme records**. The proposed R-002 records are:

- Alpha-glucosidase enzyme — 2 bottles — expiry `2026-10-06`;
- Lipase enzyme — 1 bottle — expiry `2026-10-16`.

The records stay unassigned because the request contains no canonical cabinet/shelf ID. The visible
review card is the proof: nothing is created until the researcher selects **Approve inventory**.
Wait for **Saved in this browser** before starting the next segment.

### 3. Find the stock and the work surface

Use **Ground a DPPH collection**. The agent searches and inspects:

- DPPH Reagent;
- Methanol Solvent 99.9%;
- 100 uL and 200 uL Pipette tips;
- the R-002 Laboratory pipette holder;
- the R-002 Automated microplate reader;
- Chloroform, which must remain explicitly missing.

`labspace_assess_workflow` scopes equipment and workspace ranking to R-002 while inventory evidence
can remain cross-room. After record review, `labspace_start_collection` creates Next/Previous stops
and ends by highlighting the recommended authored work surface. It does not consume stock or claim
an approved protocol, substitution, suitability determination or safety-approved route.

## Optional LLE stock proof

Expand **More judge workflows** and choose **Check an LLE solvent set**. The fixture contains exact
records for methanol, ethyl acetate, n-hexane and n-butanol. Chloroform remains absent. This is a
strong short proof that LabSpace reports negative evidence instead of hallucinating a substitute.

## Evidence export

The Inspector's **Export proof** downloads bounded session evidence: workspace, registered tool
surface, human execution policy, compact tool inputs/results and the chronological activity trail.
It is not chain-of-thought, a certified audit, or an approved laboratory procedure.

## Automated acceptance

```powershell
npm run typecheck
npx vitest run tests/unit/project-workspace.test.ts
npx playwright test tests/e2e/submission-rehearsal.spec.ts
npx playwright test tests/e2e/workspace-polish.spec.ts tests/e2e/webmcp-mission-control.spec.ts
```

`submission-rehearsal.spec.ts` imports the public fixture into a disposable e2e SQLite database,
runs all three segments, verifies the LLE missing-stock case and never writes the user's local or
online laboratory.
