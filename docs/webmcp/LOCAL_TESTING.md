# Local WebMCP Testing

LabSpace uses Chrome's experimental WebMCP Imperative API as a progressive enhancement. The Layout Editor and Digital Twin remain fully functional when the API is unavailable.

## Enable local Chrome support

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Set **WebMCP testing** to **Enabled**.
3. Relaunch Chrome.
4. Start LabSpace locally and open `http://127.0.0.1:3004/` or `http://127.0.0.1:3004/digital-twin`.

Do not enable the flag automatically in scripts or application code. Chrome's [WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp/) describes the current local-development requirement.

## Inspect registration

In DevTools Console:

```js
document.modelContext;
const tools = await document.modelContext.getTools();
tools.map(({ name, annotations }) => ({ name, annotations }));
```

Expected same-origin tools, normally returned alphabetically:

```text
labspace_get_context
labspace_inspect_record
labspace_search_records
```

The optional [Model Context Tool Inspector Extension](https://chromewebstore.google.com/detail/webmcp-model-context-tool/gbpdfapgefenggkahomfgkhfehlcenpd) can display schemas, execute tools manually, and show structured results. Installation is manual and not required by LabSpace.

## Manual calls

Chrome's current API accepts tool input as a JSON string:

```js
const tools = await document.modelContext.getTools();
const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

await document.modelContext.executeTool(byName.labspace_get_context, "{}");

const search = await document.modelContext.executeTool(
  byName.labspace_search_records,
  JSON.stringify({ query: "rotary evaporator", scope: "project", limit: 8 }),
);

await document.modelContext.executeTool(
  byName.labspace_search_records,
  JSON.stringify({ query: "Reference standards", kinds: ["inventory"] }),
);

await document.modelContext.executeTool(
  byName.labspace_search_records,
  JSON.stringify({ query: "plate reader", kinds: ["equipment"] }),
);

// Replace with a recordId returned by a search.
await document.modelContext.executeTool(
  byName.labspace_inspect_record,
  JSON.stringify({ recordId: "<recordId>" }),
);
```

Expected behavior:

- Context reflects the current project, active laboratory and room, selection, and visible Spatial Index counts.
- Search excludes `demo-template` rooms and returns compact canonical identifiers and location trails.
- Inspect resolves the record against fresh current project state.
- No call changes the active room, selected object, camera, inventory, equipment, or saved project.

If `document.modelContext` is `undefined`, confirm the flag is enabled, Chrome was relaunched, and the page is top-level and same-origin. LabSpace should still operate normally in that state.
