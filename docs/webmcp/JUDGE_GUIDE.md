# LabSpace Agent Twin — judge guide

**WebMCP for the physical laboratory.** This guide demonstrates the complete challenge flow in about three minutes.

## Open

- Live URL: [https://labspace-agent-twin.onrender.com](https://labspace-agent-twin.onrender.com). The free instance can take up to about a minute to wake after inactivity.
- Local fallback: `npm ci`, `npm run dev`, then open `http://127.0.0.1:3004/`.
- Browser: ChatGPT's WebMCP-capable in-app browser, or Chrome with `chrome://flags/#enable-webmcp-testing` enabled and relaunched.
- Select **Demo room** if DEMO-01 is not already active.

## Make WebMCP visible first

1. Open the **WebMCP** status control in the LabSpace header.
2. Select **Registered tools** to see all thirteen live tools and their safety modes.
3. Select **Run read-only check**. LabSpace invokes `labspace_get_context` through the browser's `document.modelContext.executeTool` interface.
4. Return to **Live activity** and expand the resulting entry to show the actual tool name, `{}` input, and compact project/room/count result.

This is the quickest judge-visible proof that WebMCP is active. The panel reports bounded tool evidence only; it does not expose chain-of-thought or label ordinary researcher clicks as agent activity.

Enter the prompts below in the ChatGPT/browser-agent conversation controlling this page—not in a separate LabSpace chat box. The open page exposes its tools to that conversation through WebMCP; the header inspector makes the resulting calls visible in LabSpace.

The public service assigns each browser an isolated four-hour workspace, so another judge's edits cannot alter this demo.

## Signature empty-room builder prompt

Open **Empty lab plan**, then ask:

> Build an 8 × 6 metre preparation room with 3 metre walls. Add a standard laboratory bench and a floor centrifuge with a 900 mm aisle, then stage the complete blueprint for my approval. Do not approve it for me.

Expected: the agent discovers canonical catalog IDs and dimensions, proposes four connected walls and a derived floor, then arranges the assets against that real geometry without mutation. LabSpace shows one cyan 2D/3D blueprint and a readable shell/asset manifest. **Cancel preview** restores the empty room exactly. Stage it again and choose **Approve room plan** yourself to create one undoable update containing the room dimensions, shell, assets, and applicable index records.

For the advanced builder, ask for an L-shaped six-wall room and specify a 90° instrument rotation. Bench-connected instruments such as the rotary evaporator are automatically placed at the supporting worktop elevation rather than on the floor.

## Human-reviewed inventory prompt

Open **Inventory**, then ask:

> Find Shelf 01 in DEMO-01 and propose two boxes of pipette tips there, owned by Shared. Stage the inventory plan for my review, but do not approve it.

Expected: WebMCP returns the exact canonical location ID/path, validates the new record, and opens the researcher review. Inventory does not change until **Approve inventory** is selected in LabSpace.

## Exact-evidence and move prompt

> In LabSpace, find the BÜCHI rotary evaporator and the exact storage location of its flask set, then focus the room on that evidence. Next, check whether moving the wire-basket laboratory trolley to X 4.318 m, Y 0.008 m at −180° is valid. If it is blocked, explain the recorded conflicts, find three valid alternatives near that target, choose the best grounded candidate, and stage it for my review. Do not approve anything for me.

## Expected visible workflow

1. The agent discovers thirteen structured LabSpace tools.
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
labspace_search_assets
labspace_plan_room
labspace_stage_room_plan
human: Approve room plan or Cancel preview

labspace_inventory_locations
labspace_plan_inventory
labspace_stage_inventory_plan
human: Approve inventory or Cancel preview

labspace_get_context
labspace_search_records
labspace_inspect_record
labspace_focus_record
labspace_validate_object_move  (blocked target)
labspace_find_valid_placements (three ranked alternatives)
labspace_stage_object_move
human: Approve move or Cancel
```

The agent cannot approve its own proposal. No WebMCP tool can reset, delete, import, or save a project.

## Verify registration

```js
const tools = await document.modelContext.getTools();
tools.map((tool) => tool.name);
```

Expected: exactly thirteen unique `labspace_*` tools on `/`, `/digital-twin`, and `/inventory`, and none on `/asset-preview`, `/facility`, or `/procedural-asset-capture`.

## What changed during the challenge

The annotated `pre-webmcp-2026-08-27` tag marks the verified pre-existing LabSpace boundary. All browser-agent tools, shared action adapters, human-reviewed staging, Agent Activity, tool contracts, evals, and independent WebMCP E2E coverage appear after that tag. The corrected deployed evidence tag is `webmcp-submission-v1.1`; `webmcp-submission-v1` preserves the first pre-deployment candidate.

See [ARCHITECTURE.md](ARCHITECTURE.md), [CHALLENGE_EVIDENCE.md](CHALLENGE_EVIDENCE.md), and [LOCAL_TESTING.md](LOCAL_TESTING.md).
