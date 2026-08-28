# Local WebMCP testing

LabSpace uses Chrome's experimental WebMCP Imperative API as a progressive enhancement. The Layout Editor and Digital Twin remain fully functional when that API is unavailable.

## Start the challenge branch

```powershell
git switch webmcp-challenge-2026
npm ci
npm run dev
```

Open `http://127.0.0.1:3004/` or `http://127.0.0.1:3004/digital-twin`.

## Enable local Chrome support

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Set **WebMCP testing** to **Enabled**.
3. Relaunch Chrome.
4. Open LabSpace as a top-level page.

Do not enable the flag automatically in application code. ChatGPT's in-app browser supports WebMCP directly; Chrome currently requires its experimental flag or an applicable origin trial.

## Discover the ten tools

In Chrome DevTools Console:

```js
document.modelContext;
const tools = await document.modelContext.getTools();
tools.map(({ name, title, annotations }) => ({ name, title, annotations }));
```

Expected names (Chrome normally sorts them alphabetically):

```text
labspace_find_valid_placements
labspace_focus_record
labspace_get_context
labspace_inspect_record
labspace_plan_room
labspace_search_assets
labspace_search_records
labspace_stage_object_move
labspace_stage_room_plan
labspace_validate_object_move
```

There should be ten unique registrations on `/` and `/digital-twin`, and none on `/asset-preview` or `/procedural-asset-capture`.

## Manual tool calls

Chrome 151 accepts the current tool definition plus a JSON string when calling `executeTool`:

```js
const tools = await document.modelContext.getTools();
const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

await document.modelContext.executeTool(byName.labspace_get_context, "{}");

const searchJson = await document.modelContext.executeTool(
  byName.labspace_search_records,
  JSON.stringify({ query: "Reference standards", kinds: ["inventory"] }),
);
const search = JSON.parse(searchJson);
const recordId = search.results[0].recordId;

await document.modelContext.executeTool(
  byName.labspace_inspect_record,
  JSON.stringify({ recordId }),
);

await document.modelContext.executeTool(byName.labspace_focus_record, JSON.stringify({ recordId }));
```

For the empty-room builder workflow, open **Empty lab plan**, then run:

```js
const assetJson = await document.modelContext.executeTool(
  byName.labspace_search_assets,
  JSON.stringify({ query: "laboratory bench" }),
);
JSON.parse(assetJson).results;

const planJson = await document.modelContext.executeTool(
  byName.labspace_plan_room,
  JSON.stringify({
    brief: "Compact equipment preparation room with a clear central aisle",
    aisleMm: 900,
    roomShell: {
      widthMm: 8000,
      depthMm: 6000,
      wallHeightMm: 3000,
      wallThicknessMm: 150,
    },
    assets: [
      { assetId: "lab-bench", quantity: 1, placement: "perimeter" },
      { assetId: "floor-centrifuge", quantity: 1, placement: "open" },
    ],
  }),
);
const plan = JSON.parse(planJson);

await document.modelContext.executeTool(
  byName.labspace_stage_room_plan,
  JSON.stringify({ planId: plan.planId }),
);
```

The final call creates a cyan in-memory blueprint with four connected walls, a floor derived from that closed outline, and the proposed assets. **Cancel preview** restores the exact blank room; **Approve room plan** commits the shell, room dimensions, assets, and applicable index records as one undoable history entry. Existing room walls are never replaced by the planner. The browser agent cannot approve its own plan.

For the deterministic move demo, search for `Wire-basket laboratory trolley`, inspect the returned object identity, then call:

```js
const objectId = "e4d611f7-1ca5-49e7-8005-37f987da3d80";

await document.modelContext.executeTool(
  byName.labspace_validate_object_move,
  JSON.stringify({
    objectId,
    target: { xMm: 4317.544, yMm: 7.507 },
    rotationDeg: -180,
  }),
); // blocked: boundary and collision evidence, no mutation

const recommendationJson = await document.modelContext.executeTool(
  byName.labspace_find_valid_placements,
  JSON.stringify({
    objectId,
    preferredTarget: { xMm: 4317.544, yMm: 7.507 },
    rotationsDeg: [-180, -90],
    limit: 3,
  }),
);
const recommendations = JSON.parse(recommendationJson);
recommendations.candidates; // ranked, diverse, valid alternatives; still no mutation

await document.modelContext.executeTool(
  byName.labspace_validate_object_move,
  JSON.stringify({
    objectId,
    target: { xMm: 3887.107, yMm: 8006.071 },
    rotationDeg: -180,
  }),
); // valid in the canonical challenge seed

await document.modelContext.executeTool(
  byName.labspace_stage_object_move,
  JSON.stringify({
    objectId,
    target: { xMm: 3887.107, yMm: 8006.071 },
    rotationDeg: -180,
  }),
);
```

The last call shows a reversible preview in LabSpace. Use the visible **Approve move** or **Cancel** control. No WebMCP tool can approve its own proposal.

The exact UUIDs above belong to the source-controlled DEMO-01 seed. For any edited project, discover current IDs through search rather than copying them.

## Automated verification

```powershell
npm run release:check
npx playwright test tests/e2e/webmcp-actions.spec.ts
npm run test:e2e
```

The 17 expected-call eval cases live in `docs/webmcp/evals/cases.json` and are checked by `tests/unit/webmcp-evals.test.ts`.

If `document.modelContext` is `undefined`, confirm the Chrome flag, browser relaunch, top-level route, and secure/same-origin context. LabSpace itself should continue to work normally.

Official references:

- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Chrome WebMCP Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP DevTools](https://developer.chrome.com/docs/devtools/application/webmcp)
