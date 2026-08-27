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

## Discover the six tools

In Chrome DevTools Console:

```js
document.modelContext;
const tools = await document.modelContext.getTools();
tools.map(({ name, title, annotations }) => ({ name, title, annotations }));
```

Expected names (Chrome normally sorts them alphabetically):

```text
labspace_focus_record
labspace_get_context
labspace_inspect_record
labspace_search_records
labspace_stage_object_move
labspace_validate_object_move
```

There should be six unique registrations on `/` and `/digital-twin`, and none on `/asset-preview` or `/procedural-asset-capture`.

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

await document.modelContext.executeTool(
  byName.labspace_focus_record,
  JSON.stringify({ recordId }),
);
```

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

The 12 expected-call eval cases live in `docs/webmcp/evals/cases.json` and are checked by `tests/unit/webmcp-evals.test.ts`.

If `document.modelContext` is `undefined`, confirm the Chrome flag, browser relaunch, top-level route, and secure/same-origin context. LabSpace itself should continue to work normally.

Official references:

- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Chrome WebMCP Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP DevTools](https://developer.chrome.com/docs/devtools/application/webmcp)
