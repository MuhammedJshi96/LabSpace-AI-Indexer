# Local WebMCP testing

LabSpace uses Chrome's experimental WebMCP Imperative API as a progressive enhancement. The Layout Editor and Digital Twin remain fully functional when that API is unavailable.

## Start the challenge branch

```powershell
git switch webmcp-challenge-2026
npm ci
npm run dev
```

Open `http://127.0.0.1:3004/`, `/digital-twin`, or `/inventory`.

## Enable local Chrome support

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Set **WebMCP testing** to **Enabled**.
3. Relaunch Chrome.
4. Open LabSpace as a top-level page.

Do not enable the flag automatically in application code. ChatGPT's in-app browser supports WebMCP directly; Chrome currently requires its experimental flag or an applicable origin trial.

## Discover the fourteen tools

In Chrome DevTools Console:

```js
document.modelContext;
const tools = await document.modelContext.getTools();
tools.map(({ name, title, annotations }) => ({ name, title, annotations }));
```

Expected names (Chrome normally sorts them alphabetically):

```text
labspace_create_room
labspace_find_valid_placements
labspace_focus_record
labspace_get_context
labspace_inspect_record
labspace_inventory_locations
labspace_plan_inventory
labspace_plan_room
labspace_search_assets
labspace_search_records
labspace_stage_object_move
labspace_stage_inventory_plan
labspace_stage_room_plan
labspace_validate_object_move
```

There should be fourteen unique registrations on `/`, `/digital-twin`, and `/inventory`, and none on `/asset-preview`, `/facility`, or `/procedural-asset-capture`.

## Manual tool calls

ChatGPT's in-app browser invokes tools with ordinary object arguments. Chrome 151's testing interface currently uses a JSON string. LabSpace's visible **Run read-only check** supports both signatures automatically.

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

For the initial room-builder workflow, run:

```js
const createdRoomJson = await document.modelContext.executeTool(
  byName.labspace_create_room,
  JSON.stringify({ name: "Office for Students", code: "812" }),
);
const createdRoom = JSON.parse(createdRoomJson);

const assetJson = await document.modelContext.executeTool(
  byName.labspace_search_assets,
  JSON.stringify({ query: "office desk" }),
);
JSON.parse(assetJson).results;

const planJson = await document.modelContext.executeTool(
  byName.labspace_plan_room,
  JSON.stringify({
    brief: "Six-wall student office with four paired workstations and hosted openings",
    aisleMm: 700,
    roomShell: {
      vertices: [
        { xMm: 0, yMm: 0 },
        { xMm: 7000, yMm: 0 },
        { xMm: 7000, yMm: 3000 },
        { xMm: 6000, yMm: 3000 },
        { xMm: 6000, yMm: 5000 },
        { xMm: 0, yMm: 5000 },
      ],
    },
    assets: [
      { assetId: "office-desk", quantity: 4 },
      { assetId: "office-chair", quantity: 4 },
      { assetId: "tall-cabinet", quantity: 1, placement: "perimeter" },
      {
        assetId: "single-door",
        quantity: 1,
        placement: "wall",
        host: { wallIndex: 6, offsetMm: 1000, handing: "right", swing: "inward" },
      },
      {
        assetId: "standard-window",
        quantity: 1,
        placement: "wall",
        host: { wallIndex: 1, offsetMm: 4500, sillHeightMm: 900 },
      },
    ],
  }),
);
const plan = JSON.parse(planJson);

await document.modelContext.executeTool(
  byName.labspace_stage_room_plan,
  JSON.stringify({ planId: plan.planId }),
);
```

The create call saves and activates a genuinely blank room and infers Floor 8 from room code `812`. The plan remains read-only. The final stage call verifies that every requested object was placed, then uses the room's one-use initial-layout capability to commit the six-wall shell, derived floor, paired desk/chair workstations, inward-facing cabinet, and wall-hosted openings as one undoable update. It returns `autoCommitted: true` and does not open a confirmation modal.

That capability is consumed immediately. A second room plan, a plan for any existing room, an object move, or an inventory proposal still opens a reversible **Preview · not saved** review with researcher-only Approve/Cancel controls. Existing walls are never replaced automatically.

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

The last call shows a reversible preview in LabSpace. Use the visible **Approve move** or **Cancel** control. No WebMCP tool can approve its own later placement proposal.

The exact UUIDs above belong to the source-controlled DEMO-01 seed. For any edited project, discover current IDs through search rather than copying them.

## Automated verification

```powershell
npm run release:check
npx cross-env PLAYWRIGHT_BROWSERS_PATH=0 playwright install chromium
npm run test:e2e:webmcp
npm run test:e2e
```

The 21 expected-call eval cases live in `docs/webmcp/evals/cases.json` and are checked by `tests/unit/webmcp-evals.test.ts`.

If `document.modelContext` is `undefined`, confirm the Chrome flag, browser relaunch, top-level route, and secure/same-origin context. LabSpace itself should continue to work normally.

Official references:

- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Chrome WebMCP Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP DevTools](https://developer.chrome.com/docs/devtools/application/webmcp)
