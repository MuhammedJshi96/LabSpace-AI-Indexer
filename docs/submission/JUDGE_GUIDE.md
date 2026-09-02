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

## Open the final submission workspace

The public judge fixture opens on **Lab Space AI Laboratory – DEMO Build** (`LAB-D-00`) with two
authored rooms: R-001 Analytical Chemistry Lab and R-002 Biological Assay room. It contains 55
scene objects, 27 inventory records, 15 equipment records and 169 exact storage locations. R-003 is
deliberately absent because it is created live in the final demonstration.

Wait for the status bar to report **Saved in this browser** before moving between segments.

## Recommended evaluation flow

1. Open **WebMCP** and confirm **24 tools ready** plus the visible Reviewed/Fast Draft boundary.
2. Run **Create R-003 from one request** to build and audit the 38 m² Researcher Office with its
   door, two three-panel windows, three paired desk/chair stations, locker, extinguisher and bin.
3. Run **Stage two enzyme records**. Approve the exact alpha-glucosidase and lipase entries in the
   visible human review card; neither record invents a storage assignment.
4. Run **Ground a DPPH collection**. LabSpace grounds DPPH reagent, methanol, both tip sizes,
   pipettes and the plate reader, keeps chloroform explicitly missing, then ends the reviewed
   collection guide at a real R-002 work surface.
5. Reopen **Evidence** and export the bounded WebMCP session proof.

## Additional evidence scenarios

- Expand **More judge workflows** and run the LLE solvent check: methanol, ethyl acetate,
  n-hexane and n-butanol resolve; chloroform remains absent.
- Use Spatial Index result selection to focus exact cabinets, drawers, shelves and equipment.
- Inventory, Equipment, Locations and Alerts expose the same canonical project index.

## Verification

```powershell
npm run release:check
```

For browser workflows, install Chromium once and run:

```powershell
npx playwright install chromium
npm run test:e2e
```

The final automated competition flow is in `tests/e2e/submission-rehearsal.spec.ts`.

## Data and privacy

Runtime edits are stored only in `data/labspace-indexer.sqlite`, which is created locally and excluded
from Git. The source-controlled public fixture is a privacy-checked export filtered to `LAB-D-00`;
unrelated local project state is not published. Spatial Index search is deterministic local software,
and no live model provider is included. JSON export is the portable backup format. The detailed final
WebMCP flow is in [the judge guide](../webmcp/JUDGE_GUIDE.md).
