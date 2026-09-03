# WebMCP Challenge implementation record

## Project

**LabSpace Atlas**
Design the lab. Index every location. Find anything instantly.

## The problem

Laboratories often split spatial planning, equipment records, storage indexes and inventory across floor plans, spreadsheets, photographs, labels and staff memory. LabSpace Atlas brings those records into one spatial model: moving an object updates the scene that people search, validate and navigate instead of creating another disconnected document.

## What existed before the challenge

Before the WebMCP Challenge, LabSpace already provided the core laboratory product:

- a versioned project, laboratory, room and scene schema;
- synchronized 2D and 3D layout editing;
- a searchable authored asset library;
- inventory and nested storage records;
- a project-wide Spatial Index; and
- local persistence, import/export and layout validation.

The annotated Git tag `pre-webmcp-2026-08-27` preserves this boundary so the challenge contribution can be reviewed directly.

## What the WebMCP Challenge added

The challenge work made the existing product genuinely usable by a browser agent rather than wrapping it in a second chatbot.

- **24 browser-native tools** expose bounded room, asset, inventory, search, placement, resize, workflow and collection capabilities through `document.modelContext`.
- **Shared deterministic actions** keep the visible UI and the WebMCP adapter on the same canonical project model.
- **Natural-language planning** can turn a request into a dimensioned room or annex, hosted doors and windows, inward-facing furniture, paired chairs and equipment placed on real support surfaces.
- **Human-controlled execution** starts every session in Reviewed mode. Mutations are staged for approval, while Fast Draft is a visible session-only option limited to a validated new room and its pristine first blueprint.
- **Grounded workflow assessment** resolves requested materials and equipment against live stock, keeps missing or ambiguous matches explicit, ranks real work surfaces and builds a navigable collection guide.
- **Visible evidence** records tool calls, workspace focus, proposals, approvals, cancellations and undoable commits without claiming hidden model reasoning, protocol approval or certified audit status.
- **A clean public fixture** contains only `LAB-D-00` with R-001 and R-002. R-003 is intentionally created live.
- **Independent browser verification** rehearses Build → Stock → Find against the same public fixture and regenerates the High-quality screenshots used in the README.

## Human-agent execution boundary

```text
browser agent → document.modelContext → LabSpace tool adapter
                                      → deterministic domain actions
                                      → Reviewed → preview → human Approve / Cancel
                                      → Fast Draft → bounded, validated, undoable creation
                                      → visible activity and workspace evidence
```

No tool argument can change the execution mode, approve its own proposal, delete a laboratory, import a project or write unrestricted project state. Inventory, changes to existing rooms, destructive actions and validation failures always remain behind human review.

## Runtime architecture

React and Zustand coordinate the workspace. React Konva renders the 2D plan, React Three Fiber renders the synchronized 3D room, Zod validates versioned project data, Express serves the hosted application, SQLite supports local development, and browser IndexedDB preserves each public visitor's isolated workspace.

Search, validation, planning and tool results are deterministic application behavior. LabSpace embeds no model, sends no model API request and needs no OpenAI API key. A WebMCP-capable browser agent supplies the language understanding; the product supplies structured laboratory capabilities and evidence.

## Demonstrable challenge path

1. **Build:** create and audit the 38 m² Researcher Office R-003 with one door, two windows, three desk-and-chair pairs, a locker, extinguisher and waste bin.
2. **Stock:** stage two enzyme records with exact quantities and expiry dates, then let the researcher approve them.
3. **Find the work:** resolve the DPPH workflow across R-001 and R-002, preserve chloroform as visibly unavailable, navigate the collection stops and finish at an authored R-002 work surface.

This path is not a prerecorded simulation. It operates on the active project, uses the same room and inventory data shown in the application, and is exercised by the repository's Playwright submission rehearsal.

## Collaboration and authorship

I am a biologist, not a programmer. I supplied the laboratory knowledge, reference materials, product priorities, visual direction, workflow requirements and acceptance decisions. GPT-5.6 helped translate laboratory observations into clear product and interaction requirements. Codex worked in the repository to implement, debug, test and document the React, TypeScript, Three.js, React Konva, Express, SQLite and WebMCP system.

This was an iterative human–AI collaboration: I repeatedly tested the product as a laboratory user, rejected weak results and decided what was ready. The agent accelerated implementation; it did not replace the domain judgment behind the product.

## Verification and evidence

- The release gate runs lint, strict TypeScript, asset validation, automated tests and a production build.
- `npm run test:e2e:submission` rehearses the connected challenge story and regenerates current product captures.
- `tests/e2e/webmcp-independent.spec.ts` validates the WebMCP surface independently of UI clicks.
- `tests/e2e/public-persistence.spec.ts` verifies isolation and persistence in the hosted data model.
- `docs/webmcp/ARCHITECTURE.md` documents the adapter and trust boundary.
- `docs/webmcp/CHALLENGE_EVIDENCE.md` records the dated pre-existing versus challenge-built boundary.
- `docs/webmcp/PRODUCTIVITY_BENCHMARK_V2.md` reports the measured comparison, including limitations and the slower Reviewed-inventory machine-time result.

## Licensing and privacy

Application source is licensed under Apache-2.0. Original planning assets and LabSpace media use the separate terms in `LICENSE-ASSETS.md` and `ASSET_LICENSES.md`; direct dependency notices are in `THIRD_PARTY_NOTICES.md`. Reference material informed original, logo-free geometry but private photographs and third-party product geometry are not distributed.

The hosted fixture is a sanitized presentation project. Local databases, internal QA notes, recording scripts, private references and machine-specific working instructions are excluded from the public repository.

## Honest limits

LabSpace Atlas is a hosted public prototype with browser-local workspaces, not a multi-user SaaS or a certified laboratory-safety, BIM or manufacturer-accurate system. Placement findings are deterministic planning guidance. Workflow results ground stock and space availability but do not approve a scientific protocol or consume stock automatically.
