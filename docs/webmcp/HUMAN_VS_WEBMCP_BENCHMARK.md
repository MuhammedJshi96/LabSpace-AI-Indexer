# Human-paced UI versus WebMCP benchmark

> **Preliminary pilot, superseded.** This one-run experiment used synthetic pauses and is retained for provenance only. Use the repeated, same-outcome [productivity benchmark v2](PRODUCTIVITY_BENCHMARK_V2.md) for submission evidence. Neither document is a substitute for measured participant data.

Measured on 2026-09-02 in an isolated local LabSpace workspace. This is a small, controlled comparison intended to make the challenge evidence reproducible. It is not a population usability study and does not claim that every browser, device, model, or user will produce the same timings.

## Result

Across five completed tasks, the visible manual workflow took **84.762 seconds and 44 interactions**. Reviewed WebMCP took **80.470 seconds and 14 interactions**. In this run WebMCP was **5.1% faster overall and required 68.2% fewer interactions**, with all five outcomes completed in both modes.

The aggregate hides an important product tradeoff. WebMCP was much faster for exact-location search and canonical inventory assignment. It was approximately tied for a two-item collection and a room audit, while returning more structured evidence. Exact room creation was slower in Reviewed mode because LabSpace rendered a staged geometry preview and required separate human approval for room identity and blueprint application.

| Task                                        |       Manual | Reviewed WebMCP |     Time change | Interactions |
| ------------------------------------------- | -----------: | --------------: | --------------: | -----------: |
| Find and focus one exact inventory location |     17.544 s |         9.948 s |    43.3% faster |        5 → 2 |
| Create inventory at an exact drawer         |     27.138 s |        14.533 s |    46.4% faster |       13 → 3 |
| Resolve and visit two material locations    |     13.823 s |        14.361 s |     3.9% slower |        8 → 3 |
| Audit room readiness                        |      4.712 s |         4.839 s |     2.7% slower |        2 → 1 |
| Create an exact 8 m × 4 m room shell        |     21.545 s |        36.789 s |    70.8% slower |       16 → 5 |
| **Total**                                   | **84.762 s** |    **80.470 s** | **5.1% faster** |  **44 → 14** |

## Controlled method

- Manual and WebMCP trials used separate same-seed browser origins on one isolated local server, so neither path touched the user's normal local workspace or the deployed rooms.
- Manual work used visible controls only. Fixed pauses represented reading the brief, orienting after navigation, entering values, and checking the visible result. The room shell used the actual rectangular-room drag tool.
- WebMCP work used only the twenty-three registered public tools and the visible approval controls required by default Reviewed mode.
- Each timer began after its starting page was loaded and ended at an authoritative visible result. WebMCP time includes tool execution, 3D/staged-preview rendering, and human approval pauses. It excludes language-model inference and prompt composition.
- An interaction is one click, field entry, selection, canvas drag, approval, or WebMCP call. Passive waits are timed but not counted as interactions.
- One successful measured run was retained for each path. Short pilot attempts used to resolve ambiguous accessibility locators were discarded before timing and caused no retained project mutation.
- Balanced rendering remained enabled. Both paths achieved five of five task outcomes.
- Browser diagnostics contained no application errors. Both origins emitted only the existing Three.js `THREE.Clock` deprecation warning, which did not interrupt a task.

## Outcome notes

### Exact-location search

Both paths found `Rotary evaporator flask set` at `North reagent cabinet / Drawer 02`. Manual use required opening the demo, navigating to Spatial Index, searching, selecting, and focusing. WebMCP used `labspace_search_records` followed by `labspace_focus_record`.

### Exact inventory assignment

Both paths created `4 bottles` of `Benchmark buffer solution` at DEMO-01's `North reagent cabinet / Drawer 01`. Manual use traversed Inventory, Storage, the room filter, cabinet picker, destination selector, and item form. WebMCP resolved the canonical location ID and staged one proposal; the record did not exist until the visible **Approve inventory** action.

### Two-item collection

Manual use searched and visited `Nitrile gloves, M` and `Reference standards` independently. WebMCP matched both stored records and created a resumable Next/Previous collection guide. It remained explicitly a collection checklist—not a certified walking route, experiment protocol, stock reservation, or consumption event.

### Room audit

Manual use exposed zero placement warnings in the Issues tab. WebMCP returned the same ready state plus structured checks for a closed shell, hosted openings, boundary containment, supported bench equipment, and unique index codes.

### Exact room creation

Manual use created `Benchmark Office / B812` and drew the rectangular shell. The first grid-aligned drag visibly produced `36.80 m²`; reading the result, using Undo, and correcting the drag produced exactly `32.00 m²`. Reviewed WebMCP proposed a Floor 8 room, paused for identity approval, calculated an exact `8000 × 4000 mm` shell, rendered a reversible preview, and paused again before applying it. The safety and precision gain cost 15.244 seconds in this single run but reduced interactions from sixteen to five.

## Honest interpretation

The strongest measured result is **interaction compression with preserved human control**, not universal speed. Canonical search and inventory assignment were both faster and substantially shorter through WebMCP. Read-only audit and collection tasks were effectively tied at local-browser scale. Reviewed geometry creation was slower but exact, deterministic, reversible, and explicitly approved.

The raw machine-readable evidence is in [`evals/human-vs-webmcp-benchmark-2026-09-02.json`](evals/human-vs-webmcp-benchmark-2026-09-02.json). A future external-user study should repeat the matrix with multiple first-time participants and report medians and variability before making broader productivity claims.
