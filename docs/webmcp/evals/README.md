# LabSpace WebMCP evaluation cases

This folder defines a deterministic competition eval set for the twenty-four public LabSpace WebMCP tools. It is an expected-call suite, not a claim that a language model is embedded in LabSpace or that every model will choose an identical optional inspection step.

For the final submission, `submission-smoke.json` provides a deliberately small
four-case gate in the format accepted by Chrome's experimental `webmcp-evals`
CLI. It checks the public deployment's workspace/audit reads, Reviewed room
proposal, Reviewed two-record inventory proposal, and grounded DPPH workflow.
Run it without an API key or model charge using:

```powershell
npm run eval:webmcp:submission
```

The pinned evaluator opens a fresh Chrome page for every case. Its small runner
preserves the console transcript and a machine-readable pass summary under
`output/webmcp-evals/submission/`; that output folder is ignored by Git. This
smoke gate executes concrete expected calls and does not measure natural-language
model selection. The existing Playwright submission rehearsal remains the
authoritative end-to-end check for visible application state, approval,
persistence, camera handoff, and the final collection itinerary.

The repeated [productivity benchmark v2](../PRODUCTIVITY_BENCHMARK_V2.md) is the primary quantitative comparison. It uses equal persisted outcomes, one excluded warm-up, five counterbalanced measured trials per task and method, medians/IQRs, explicit operation counts, and a strict warning that automated UI timing is not human timing. Its summary and timing arrays are stored in `productivity-benchmark-v2-2026-09-02.json`. The older one-run human-paced pilot remains available for provenance but is superseded.

The [persona-paced sensitivity model](../PERSONA_SENSITIVITY_MODEL.md) applies configurable reading, typing, pointing, orientation, review, and scripted-recovery assumptions to those measured system medians. It is design analysis only, not participant evidence. Its condensed output is stored in `persona-paced-sensitivity-2026-09-02.json`.

## What the automated check proves

`tests/unit/webmcp-evals.test.ts` verifies that every case has a unique identifier, uses only the published twenty-four-tool surface, declares forbidden mutations, and preserves the intended safety boundary: Reviewed is the session default; human-authorized Fast Draft is limited to a validated additive blank room and its complete pristine first blueprint; annexes, later room changes, moves, resizes, inventory/stock, destructive edits, and validation failures require human approval. The underlying action tests separately verify the execution policy, blank-room proposals, canonical reads, room audits, catalog and location search, exact record focus, deterministic geometry, polygon room and annex plans, hosted openings, workstation pairing, inventory plans, reversible staging, approval, cancellation, persistence, bounded output, and controlled errors.

## Manual model/tool inspection

1. Start LabSpace locally and open the normal Layout Editor route in a Chrome build with WebMCP testing enabled.
2. Inspect `await document.modelContext.getTools()` and confirm the exact twenty-four tools in `cases.json` are registered once.
3. Run each prompt through the current WebMCP Model Context Tool Inspector or an agent host that supports the browser API.
4. Record the actual tool sequence, inputs, compact outputs, forbidden-tool violations, and final visible application state.
5. For the initial-creation case, confirm Reviewed opens proposals for both room creation and its first blueprint. Then authorize Fast Draft through the human UI and confirm only the validated additive room and complete pristine first blueprint auto-apply, with the blueprint remaining undoable. For later staging cases, confirm the preview is marked **PREVIEW · NOT SAVED** and only the researcher-facing Approve/Cancel controls can commit or reject it.
6. Reset the local test project between mutation-oriented cases so previous rooms or staged changes cannot affect later project-wide search assertions.

Read-only prompts pass when their answer is grounded in returned canonical records and no room, selection, camera, project, version, history, or persistence state changes beyond an explicitly requested focus. Validation prompts pass only when the reported conflicts come from current deterministic room geometry. The initial room case passes only when creation is blank, the blueprint is complete, the capability is consumed once, and Undo is preserved. Every other staging prompt passes only when a valid preview is created without persistence and remains blocked on explicit human approval.

## Primary references

- [Chrome WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP evaluation guidance](https://developer.chrome.com/docs/ai/webmcp/evals)
- [WebMCP specification draft](https://github.com/webmachinelearning/webmcp/blob/main/index.bs)
- [WebMCP security and privacy questionnaire](https://github.com/webmachinelearning/webmcp/blob/main/security-privacy-questionnaire.md)
