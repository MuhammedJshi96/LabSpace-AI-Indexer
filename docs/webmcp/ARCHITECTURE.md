# LabSpace WebMCP Architecture

Phase 1 exposes a read-only browser-agent boundary over the same state and index used by the LabSpace interface:

```text
Browser agent
    ↓
document.modelContext (WebMCP)
    ↓
LabSpace WebMCP adapter
    ↓
LabSpace read actions
    ↓
Digital Twin index
    ↓
canonical Zustand project state
```

## Boundaries

- `src/agent/labspace-read-actions.ts` expresses LabSpace capabilities and has no WebMCP dependency.
- Every action calls a state reader at execution time. It never retains a project snapshot from registration time.
- Search and inspection rebuild the current canonical index with `buildDigitalTwinIndex()` and reuse `filterDigitalTwinIndex()` for query and scope behavior.
- `src/webmcp/register-labspace-tools.ts` owns only schemas, annotations, controlled errors, delegation, and registration lifecycle.
- `src/components/WebMCPBridge.tsx` feature-detects through `document.modelContext`. Unsupported browsers keep the complete normal LabSpace experience.
- The bridge mounts only on the Layout Editor and Digital Twin routes, not internal asset-preview or capture routes.

## Lifecycle

Each bridge mount registers exactly three tools using one `AbortController`. Cleanup aborts the registration signal, unregistering that mount's tools. A React StrictMode unmount/remount therefore removes the first set before activating the replacement set.

## Security and data handling

All Phase 1 tools use `readOnlyHint: true`. They also use `untrustedContentHint: true` because project names, owners, notes, equipment details, and inventory content may be user-authored or externally sourced.

No tool changes project data, selection, camera state, history, storage, or persistence. No tool is exposed cross-origin. The existing top-level same-origin page uses the default `tools` permissions policy (`self`), and the server does not opt out of origin isolation with `Origin-Agent-Cluster: ?0`; no HTTP headers were changed for Phase 1.

Search results are progressively disclosed and kept near the current 1.5K-character output guidance. Exact identifiers are retained; descriptive user text is compacted. Inspection returns recorded values or `null` and never invents missing laboratory data.
