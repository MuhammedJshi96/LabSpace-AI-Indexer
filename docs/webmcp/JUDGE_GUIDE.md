# LabSpace AI Agent Twin — judge guide

**WebMCP for the physical laboratory.** Start with the signature proof in about 60 seconds, then
continue into the complete three-minute challenge flow.

## Open

- Live URL: [https://labspace-agent-twin.onrender.com](https://labspace-agent-twin.onrender.com). The free instance can take up to about a minute to wake after inactivity.
- Local fallback: `npm ci`, `npm run dev`, then open `http://127.0.0.1:3004/`.
- Browser: ChatGPT's WebMCP-capable in-app browser, or Chrome with `chrome://flags/#enable-webmcp-testing` enabled and relaunched.
- Select **Demo room** if DEMO-01 is not already active.

## 60-second signature proof

1. Open the **WebMCP** status control in the LabSpace header.
2. Confirm **24 tools ready**. The execution boundary starts in **Reviewed**.
3. In **Judge mission**, choose **Copy + show workspace** or its shorter voice version. The Inspector
   closes so the exact 2D/3D evidence remains unobstructed; paste or speak the request in the
   browser-agent conversation controlling this page. The copied request explicitly says to use
   only the page's `labspace_*` WebMCP tools. It forbids click/drag/computer-control fallback and
   asks the agent to report a missing connection instead.
4. Watch LabSpace ground the request in canonical tools, focus the exact room/storage evidence, and
   retain the human decision boundary.
5. Open **Evidence** to expand the actual tool inputs/results. Select **Export proof** to download a
   bounded JSON record containing the workspace context, tool registrations, execution mode,
   outcome counts, and chronological event trail.

The export is intentionally session evidence—not hidden reasoning, a certified audit log, or an
approved laboratory protocol. Ordinary interface clicks are not mislabeled as agent activity.

## Inspect the complete integration

1. Open **Tools** to see all twenty-four live registrations and their safety modes.
2. Open **Setup**, then select **Run read-only check**. LabSpace invokes `labspace_get_context`
   through the browser's `document.modelContext.executeTool` interface.
3. Return to **Evidence** and expand the resulting entry to show the actual tool name, `{}` input,
   and compact project/room/count result.
4. Expand **More judge workflows** in **Judge mission** to copy a complete build, inventory,
   collection, annex, exact-evidence, audit, or resize request.

This is the quickest judge-visible proof that WebMCP is active. The panel reports bounded tool evidence only; it does not expose chain-of-thought or label ordinary researcher clicks as agent activity.

Enter the prompts below in the ChatGPT/browser-agent conversation controlling this page—not in a separate LabSpace chat box. The open page exposes its tools to that conversation through WebMCP; the header inspector makes the resulting calls visible in LabSpace.

Chrome DevTools is intentionally different: it is a manual debugger that executes one selected tool with JSON arguments. For natural-language workflows in Chrome, use Google's Model Context Tool Inspector extension; for the simplest judge flow, use ChatGPT's in-app browser.

The public service saves an independent workspace in each browser. Wait for **Saved in this browser** before closing the tab: refreshes and site deployments retain your rooms. Other judges' browsers cannot alter your project. Export JSON before clearing site data or moving to another browser/device; this is not cloud sync.

## Signature room-creation prompt

From any editable room, ask:

> Create an empty room in the current laboratory named Office for Students, room number 812. Give it a six-wall enclosure of about 32 square metres with four desks, four chairs, one cabinet, one door, and one observation window.

Expected in **Reviewed**: LabSpace first shows a room-creation proposal; the human selects **Create room**. The agent then discovers exact catalog IDs, calculates a non-crossing six-wall shell, hosts the door/window on real wall segments, pairs each chair with one desk, and faces perimeter furniture into the room. The complete blueprint appears as a second review before commit.

Expected in **Fast Draft**: the validated blank room and its complete first blueprint may apply through the bounded additive path; the blueprint is one undoable history update. The mode remains visible in the Inspector and every automatic decision is recorded. A reload returns to Reviewed.

This is a deliberately narrow capability, not silent general editing. The agent has no mode argument. An incomplete initial blueprint, a second furnishing request, any existing-room plan, object movement or resize, inventory/stock, and destructive changes still open **Preview · not saved** and require the researcher to approve or cancel them. Bench-connected instruments such as the rotary evaporator also snap to the supporting worktop elevation rather than the floor.

## Voice-ready complex build proof

Use the **Build a complete room** workflow in the Inspector, or speak its Bio-001 request in the
browser-agent conversation. The host conversation supplies the voice transcript; LabSpace receives
the same text intent and exposes the same structured tools as a typed request.

Expected accepted geometry: a 44 m² four-wall main room on Floor 5, centered inward double door,
back/left three-pane windows, workstation-aware chair pairing, and all requested main-room assets;
then a separately reviewed 20 m² connected annex with an inward single door, three lockers, and one
freezer. The final deterministic audit reports the two closed floor areas independently. The full
observed result is recorded in
[WEBMCP_SIGNATURE_WORKFLOWS_2026-09-02.md](../qa/WEBMCP_SIGNATURE_WORKFLOWS_2026-09-02.md).

## Human-reviewed inventory prompt

Open **Inventory**, then ask:

> Find Shelf 01 in DEMO-01 and propose two boxes of pipette tips there, owned by Shared. Stage the inventory plan for my review, but do not approve it.

Expected: WebMCP returns the exact canonical location ID/path, validates the new record, and opens the researcher review. Inventory does not change until **Approve inventory** is selected in LabSpace.

## Exact-evidence and move prompt

> Use only the LabSpace `labspace_*` WebMCP tools; do not use UI automation. Find the BÜCHI rotary evaporator and the exact storage location of its flask set, then focus the room on that evidence. Next, check whether moving the wire-basket laboratory trolley to X 4.318 m, Y 0.008 m at −180° is valid. If it is blocked, explain the recorded conflicts, find three valid alternatives near that target, choose the best grounded candidate, and stage it for my review. Do not approve anything for me.

For object-relative language such as “in front of the laboratory chair,” pass `relativeTo` to
`labspace_find_valid_placements`. LabSpace interprets the relation from the reference object's
authored front, checks the moving asset's front working zone, and returns the position and facing
rotation together. Screen axes and the current camera are never treated as semantic directions.

## Expected visible workflow

1. The agent discovers twenty-four structured LabSpace tools.
2. Search/inspect returns canonical BÜCHI and flask-set records, including room, index code, and human storage trail.
3. Focus switches the normal LabSpace scene and evidence inspector to the exact record and camera context.
4. The first trolley target is rejected by deterministic room-boundary/collision evidence. Nothing moves and no history entry is created.
5. LabSpace searches the actual room geometry and returns three diverse ranked alternatives, each already passing the supported deterministic rules.
6. The chosen candidate appears as a **Preview · not saved** move.
7. LabSpace shows the researcher the current and proposed position with **Cancel** and **Approve move**.
8. Choose **Cancel** to prove exact reversal, or stage again and choose **Approve move** to create one normal undoable history entry and autosave.
9. Open the **WebMCP** inspector to see the exact tool names, bounded inputs, and structured results without hidden reasoning.

## Tool sequence

```text
labspace_get_context
labspace_audit_room
labspace_create_room
human: Create room or Cancel (Reviewed default)
labspace_search_assets
labspace_plan_room
labspace_plan_annex
labspace_stage_room_plan
labspace_stage_annex_plan
human: Approve room plan or Cancel preview (Reviewed default)
Fast Draft only: validated additive room + complete pristine first build with Undo

labspace_inventory_locations
labspace_plan_inventory
labspace_stage_inventory_plan
human: Approve inventory or Cancel preview

labspace_assess_workflow
labspace_start_collection
labspace_collection_step  (Next / Previous / final workspace)
human: Confirm individual checkpoints; no stock transaction

labspace_get_context
labspace_search_records
labspace_inspect_record
labspace_focus_record
labspace_validate_object_move  (blocked target)
labspace_find_valid_placements (three ranked alternatives)
labspace_stage_object_move
human: Approve move or Cancel

labspace_validate_resize
labspace_stage_resize
human: Approve resize or Cancel preview
```

The agent cannot select Fast Draft or approve its own proposal. No WebMCP tool can reset, delete, import, or perform an unrestricted project save. `labspace_create_room` is restricted to one blank room, and its initial-build capability cannot move or overwrite existing content.

## Verify registration

```js
const tools = await document.modelContext.getTools();
tools.map((tool) => tool.name);
```

Expected: exactly twenty-four unique `labspace_*` tools on `/`, `/digital-twin`, and `/inventory`, and none on `/asset-preview`, `/facility`, or `/procedural-asset-capture`.

## What changed during the challenge

The annotated `pre-webmcp-2026-08-27` tag marks the verified pre-existing LabSpace boundary. All browser-agent tools, shared action adapters, bounded initial-room creation, later-change review, Agent Activity, tool contracts, evals, and independent WebMCP E2E coverage appear after that tag. The final audited evidence tag is `webmcp-submission-v1.3`; the earlier submission tags preserve historical release candidates.

See [ARCHITECTURE.md](ARCHITECTURE.md), [CHALLENGE_EVIDENCE.md](CHALLENGE_EVIDENCE.md),
[LOCAL_TESTING.md](LOCAL_TESTING.md), and the
[September 2 signature-workflow acceptance](../qa/WEBMCP_SIGNATURE_WORKFLOWS_2026-09-02.md).
