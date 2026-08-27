# Pre-WebMCP Baseline

Baseline application commit: `b4d8471483472a42901d5fbb20b781666c0a8d3b`

Date: 2026-08-27

## Verification

- `npm ci`: PASS
- `npm run release:check`: PASS
- Lint: PASS
- TypeScript: PASS
- Asset validation: PASS
- Unit/integration tests: 115/115 PASS
- Production build: PASS

## Known pre-existing E2E issue

The historical Spatial Index E2E contains assumptions tied to older demo data and serial test state. Investigation before WebMCP development confirmed:

- Serial state leakage can create multiple project-wide `Reference standards` matches.
- The current Spatial Index correctly excludes `demo-template` rooms.
- The eligible authored DEMO-01 showcase record resolves correctly.
- A later Playwright record-selection/navigation interaction has an unresolved actionability timeout in the historical E2E workflow.

No production source code was changed during this investigation. No WebMCP implementation existed at this baseline.

The application and source baseline behavior corresponds to commit `b4d8471483472a42901d5fbb20b781666c0a8d3b`. The following baseline commit adds this documentation only.
