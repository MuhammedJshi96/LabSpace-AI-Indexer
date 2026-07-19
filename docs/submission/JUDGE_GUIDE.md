# LabSpace AI Indexer — judge guide

LabSpace AI Indexer runs locally with no account, API key, paid service, or external asset download. The repository includes the authored GLBs, catalog renders, material textures, evidence photographs, and offline Draco decoder required by the demo.

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
2. Open **Digital Twin** from the centered product navigation.
3. Open **Ask LabSpace** and choose:

   > Where is the BÜCHI rotary evaporator and which cabinet contains its flasks?

4. Confirm the two grounded records: **BÜCHI rotary evaporator R-300** and **Rotary evaporator flask set**.
5. Select the flask evidence. The right inspector should show **North reagent cabinet / Drawer 02**, its canonical location code, evidence photograph, and a controllable access preview.
6. Return to **Layout Editor**, move the rotary evaporator in 2D, and confirm the synchronized 3D camera keeps the user's orbit while the object updates.
7. Move it into a visibly conflicting position or use the automated competition test fixture.
8. Return to **Digital Twin**, focus the evaporator, and ask:

   > Can I safely place it here?

9. Confirm that Ask LabSpace reports the deterministic spatial conflict, identifies the actual rule, offers a geometry-derived alternative, and becomes validator-clean after **Apply valid placement**.

## Additional evidence scenarios

- **Which equipment needs maintenance soon?** resolves the service-due vacuum cold-trap station.
- **Which inventory item is still missing a physical location?** resolves the deliberately unassigned buffer stock without fabricating a cabinet.
- Inventory, Equipment, and Locations in the left rail expose the same canonical project index used by Ask LabSpace.

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

Runtime edits are stored only in `data/labspace-indexer.sqlite`, which is created locally and excluded from Git. The sanitized DEMO-01 fixture is intentionally source-controlled so a clean clone includes the video room; unrelated local project state is not published. The bundled no-billing Ask LabSpace mode performs deterministic, grounded orchestration over the current project records; it is not represented as a live GPT response. JSON export is the portable backup format.
