# LabSpace WebMCP evaluation cases

This folder defines a deterministic competition eval set for the six public LabSpace WebMCP tools. It is an expected-call suite, not a claim that a language model is embedded in LabSpace or that every model will choose an identical optional inspection step.

## What the automated check proves

`tests/unit/webmcp-evals.test.ts` verifies that every case has a unique identifier, uses only the published six-tool surface, declares forbidden mutations, and requires human approval whenever an object-move preview is staged. The underlying action tests separately verify canonical data reads, exact record focus, deterministic geometry validation, reversible staging, approval, cancellation, persistence, bounded output, and controlled errors.

## Manual model/tool inspection

1. Start LabSpace locally and open the normal Layout Editor route in a Chrome build with WebMCP testing enabled.
2. Inspect `await document.modelContext.getTools()` and confirm the exact six tools in `cases.json` are registered once.
3. Run each prompt through the current WebMCP Model Context Tool Inspector or an agent host that supports the browser API.
4. Record the actual tool sequence, inputs, compact outputs, forbidden-tool violations, and final visible application state.
5. For staging cases, confirm the preview is marked **PREVIEW · NOT SAVED** and only the researcher-facing Approve/Cancel controls can commit or reject it.
6. Reset the local test project between mutation-oriented cases so previous rooms or staged changes cannot affect later project-wide search assertions.

Read-only prompts pass when their answer is grounded in returned canonical records and no room, selection, camera, project, version, history, or persistence state changes beyond an explicitly requested focus. Validation prompts pass only when the reported conflicts come from current deterministic room geometry. Staging prompts pass only when a valid preview is created without persistence and remains blocked on explicit human approval.

## Primary references

- [Chrome WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP evaluation guidance](https://developer.chrome.com/docs/ai/webmcp/evals)
- [WebMCP specification draft](https://github.com/webmachinelearning/webmcp/blob/main/index.bs)
- [WebMCP security and privacy questionnaire](https://github.com/webmachinelearning/webmcp/blob/main/security-privacy-questionnaire.md)

