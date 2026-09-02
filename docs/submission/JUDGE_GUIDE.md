# LabSpace Atlas — judge guide

LabSpace Atlas runs locally with no account, API key, paid service, or external asset download. The repository includes the authored GLBs, catalog renders, material textures, evidence photographs, and offline Draco decoder required by the demo.

## Start

Requirements: Node.js 22.5 or newer; Node.js 24 LTS is recommended.

```powershell
git clone https://github.com/MuhammedJshi96/LabSpace-AI-Indexer.git
cd LabSpace-AI-Indexer
npm ci
npm run dev
```

Open <http://127.0.0.1:3004/>. A clean clone opens on **Empty lab plan**. No login is required.

## Open the included video-showcase room

1. Select **Demo room** in the application header.
2. Wait for the status bar to report that changes are saved.

The repository includes the user's complete, sanitized **DEMO-01** presentation room: 50 total scene objects, including 30 placed furniture/storage/equipment/safety objects, 10 inventory records, 10 equipment records, and 15 exact storage locations. Room context is disabled by default. Reloading preserves the room rather than reseeding or rearranging it.

The room identity workspace also exposes **Create demo from template** as an optional copy/reset utility. That immutable factory source produces a separate editable room and never overwrites DEMO-01. It does not represent a reduced website build; all application modules and assets remain available in the same repository.

## Recommended evaluation flow

1. Inspect the synchronized 2D/3D room in **Layout Editor**.
2. Open **Spatial Index** from the centered product navigation.
3. In **Spatial Index Finder**, search:

   > rotary evaporator

4. Select **BÜCHI rotary evaporator R-300** and confirm that the live room focuses the exact equipment record.
5. Select **Rotary evaporator flask set** from the same results. The right inspector should show **North reagent cabinet / Drawer 02**, its canonical location code, evidence photograph, and a controllable access preview.
6. Return to **Layout Editor**, move the rotary evaporator in 2D, and confirm the synchronized 3D camera keeps the user's orbit while the object updates.
7. In a temporary room copy, move it into a visibly conflicting position or use the automated competition test fixture.
8. Confirm that the 2D selection status and **Warnings** tab report the deterministic spatial conflict and identify the affected object. Placement warnings are planning guidance, not safety certification.
9. Return to **Spatial Index**, search `BÜCHI rotary evaporator`, select the result, and confirm that its exact record and scene focus remain coherent with the moved room object.

## Additional evidence scenarios

- Choose **Alerts** to inspect the service-due vacuum cold-trap station.
- Search `unassigned` or use the Inventory view to inspect the deliberately unassigned buffer stock without fabricating a cabinet.
- Inventory, Equipment, Locations, and Alerts in the left rail expose the same canonical project index used by the Finder.

## Verification

```powershell
npm run release:check
```

For browser workflows, install Chromium once and run:

```powershell
npx playwright install chromium
npm run test:e2e
```

The primary automated competition flow is in `tests/e2e/build-week-demo.spec.ts`.

## Data and privacy

Runtime edits are stored only in `data/labspace-indexer.sqlite`, which is created locally and excluded from Git. The sanitized DEMO-01 fixture is intentionally source-controlled so a clean clone includes the video room; unrelated local project state is not published. Spatial Index search is deterministic local software, and no live model provider is included. A possible LabSpace Atlas API is documented only as future architecture. JSON export is the portable backup format.
