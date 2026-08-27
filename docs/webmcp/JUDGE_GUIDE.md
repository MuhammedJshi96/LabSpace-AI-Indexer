# LabSpace Agent Twin — judge guide

**WebMCP for the physical laboratory.** This guide demonstrates the complete challenge flow in about three minutes.

## Open

- Live URL: **pending one-time Render account connection**; see [DEPLOYMENT.md](DEPLOYMENT.md).
- Local fallback: `npm ci`, `npm run dev`, then open `http://127.0.0.1:3004/`.
- Browser: ChatGPT's WebMCP-capable in-app browser, or Chrome with `chrome://flags/#enable-webmcp-testing` enabled and relaunched.
- Select **Demo room** if DEMO-01 is not already active.

## Best judge prompt

> In LabSpace, find the BÜCHI rotary evaporator and the exact storage location of its flask set, then focus the room on that evidence. Next, check whether moving the wire-basket laboratory trolley to X 4.318 m, Y 0.008 m at −180° is valid. If it is blocked, explain the recorded conflicts, validate X 3.887 m, Y 8.006 m instead, and stage that valid move for my review. Do not approve anything for me.

## Expected visible workflow

1. The agent discovers six structured LabSpace tools.
2. Search/inspect returns canonical BÜCHI and flask-set records, including room, index code, and human storage trail.
3. Focus switches the normal LabSpace scene and evidence inspector to the exact record and camera context.
4. The first trolley target is rejected by deterministic room-boundary/collision evidence. Nothing moves and no history entry is created.
5. The second target validates and appears as a **Preview · not saved** move.
6. LabSpace shows the researcher the current and proposed position with **Cancel** and **Approve move**.
7. Choose **Cancel** to prove exact reversal, or stage again and choose **Approve move** to create one normal undoable history entry and autosave.
8. Open **Agent Activity** to see compact action/evidence records without hidden reasoning.

## Tool sequence

```text
labspace_get_context
labspace_search_records
labspace_inspect_record
labspace_focus_record
labspace_validate_object_move  (blocked target)
labspace_validate_object_move  (valid target)
labspace_stage_object_move
human: Approve move or Cancel
```

The agent cannot approve its own proposal. No WebMCP tool can reset, delete, import, or save a project.

## Verify registration

```js
const tools = await document.modelContext.getTools();
tools.map((tool) => tool.name);
```

Expected: exactly six unique `labspace_*` tools on `/` and `/digital-twin`, and none on `/asset-preview` or `/procedural-asset-capture`.

## What changed during the challenge

The annotated `pre-webmcp-2026-08-27` tag marks the verified pre-existing LabSpace boundary. All browser-agent tools, shared action adapters, human-reviewed staging, Agent Activity, tool contracts, evals, and independent WebMCP E2E coverage appear after that tag. The final evidence tag is `webmcp-submission-v1`.

See [ARCHITECTURE.md](ARCHITECTURE.md), [CHALLENGE_EVIDENCE.md](CHALLENGE_EVIDENCE.md), and [LOCAL_TESTING.md](LOCAL_TESTING.md).
