# LabSpace productivity benchmark v2

Measured on 2026-09-02 (JST) in an isolated local LabSpace workspace. This supersedes the earlier one-run human-paced pilot as the primary quantitative comparison.

## What this benchmark proves

The benchmark measures repeatable **application execution**, **interaction compression**, and **outcome fidelity** for equal tasks. It does not pretend that browser automation is a person.

- One excluded warm-up and five measured trials were run for each task and method.
- Manual UI and Reviewed WebMCP order alternated between trials.
- Every trial began from the same reset seed in a fresh browser context.
- Only one Chromium context ran at a time; trace, video, screenshots, and 3D rendering were disabled to bound memory and remove GPU compilation from the comparison.
- The timer began on a prepared page and ended only after the visible or persisted outcome was verified. Page load, seed reset, language-model inference, and prompt composition were outside this timing boundary.
- The manual path used accessible visible controls. The WebMCP path executed the real registered tool definitions through the same injected Model Context boundary used by deterministic browser tests, then used the normal researcher-facing Reviewed approvals.
- All **140 measured outcome checks passed**, with no captured application errors.

These are automated browser execution times. They must not be described as observed human task-completion times.

## Results

Times are medians of five measured trials. IQR is the 25th–75th percentile. “Operations” means UI commands for the manual path versus WebMCP calls plus required human approvals for the agent path.

| Equal verified outcome                                                                 |   Manual UI median (IQR) | Reviewed WebMCP median (IQR) | Median system-time change | Operations |
| -------------------------------------------------------------------------------------- | -----------------------: | ---------------------------: | ------------------------: | ---------: |
| Locate and visibly verify three stored materials                                       | 19.741 s (18.474–20.856) |        0.522 s (0.521–0.545) |               97.4% lower |      6 → 4 |
| Add five named stock records to the same canonical drawer                              |    1.045 s (0.965–1.062) |        2.247 s (1.314–2.303) |             115.0% higher |     30 → 3 |
| Create an exact 8 × 6 m office with four walls, two desks, two chairs, and one cabinet |   9.683 s (9.040–11.116) |        7.102 s (6.649–7.193) |               26.7% lower |     18 → 5 |

For one fixed pass through this three-task suite, the sum of task medians is **30.469 s through automated visible UI versus 9.871 s through Reviewed WebMCP** (67.6% lower prepared-page system time). Operations fall from **54 to 12** (77.8% fewer). This composite is secondary evidence only: its value depends on the chosen task mix.

## Outcome contracts

### Three-material exact-location evidence

Both methods selected `Reference standards`, `Nitrile gloves, M`, and `Rotary evaporator flask set` and exposed the selected-record dossier and exact physical location. The manual path performed three searches and three record selections. WebMCP used `labspace_resolve_materials`, `labspace_start_collection`, and two `labspace_collection_step` calls. The WebMCP result additionally left a Next/Previous collection guide, but did not deduct stock or claim an approved protocol or safe walking route.

### Five records in one drawer

Both methods created the same five names and quantities at `CHR-A / Chromatography consumables cabinet / Drawer 01`, then verified all five canonical assignments in persisted project data. The manual path opened the Storage workspace, selected the cabinet and drawer, and completed five item forms. WebMCP used one location-discovery call and one five-entry proposal, then required **Approve inventory**. The tool path is slower at machine input speed because staging, review, approval, and persistence are real work; it nevertheless compresses 30 direct operations to three controlled operations. A person cannot be assumed to complete fifteen form fields at automation speed.

### Exact furnished office

Both methods created `Benchmark Student Office / B812` with exactly 48 m², four walls, two office desks, two office chairs, and one tall cabinet. The manual path used the project workspace, rectangular-room drag tool, and searchable Asset Library. Reviewed WebMCP separately staged room identity and the complete blueprint and required two approvals. The persisted scene—not preview text—was used for all five outcome checks.

## Raw measurements

The machine-readable summary and all measured timing arrays are in [`evals/productivity-benchmark-v2-2026-09-02.json`](evals/productivity-benchmark-v2-2026-09-02.json). The reproducible harness is [`benchmarks/webmcp-productivity.spec.ts`](../../benchmarks/webmcp-productivity.spec.ts) with [`playwright.benchmark.config.ts`](../../playwright.benchmark.config.ts). Run it with:

```text
npm run benchmark:webmcp
```

The benchmark uses its own database and test-only reset route. It does not touch the normal local workspace or deployed rooms.

## Required human study before a human-speed claim

Use the same three pre-registered outcome contracts with at least eight participants: four first-time planning users and four laboratory-adjacent users. Use a within-subject Latin-square order, one practice task, the same device and viewport, and a fresh seed for every trial.

For the manual condition, time from brief display to verified outcome. For WebMCP, paste the same standardized prompt and include model inference, tool execution, review reading, approvals, and correction attempts. Record success, time on successful task, validation/retry count, wrong-room or wrong-location errors, and a one-question ease score after each task. Report medians, IQRs, individual paired differences, and failures; do not replace failures with timeout values or discard participants after seeing results.

Until that study exists, the defensible submission claim is: **LabSpace's WebMCP workflows substantially reduce direct operations while preserving exact persisted outcomes and Reviewed human control; repeated browser measurements show task-dependent execution latency, including one honest slower case.**

The separate [persona-paced sensitivity model](PERSONA_SENSITIVITY_MODEL.md) explores explicit expert, first-time, general-user, programmer, and low-digital-confidence pacing assumptions. It is useful for product decisions but remains modeled rather than observed evidence.
