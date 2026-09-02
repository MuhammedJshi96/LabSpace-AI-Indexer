# Devpost draft — LabSpace Atlas

## Elevator pitch

Design the lab. Index every asset. Find anything instantly—in one intelligent spatial digital twin.

## Inspiration

Laboratory teams still depend on memory, spreadsheets, photographs, labels, and disconnected floor plans to answer simple operational questions: Where is the equipment? Which drawer contains its accessories? Is this new placement physically valid? LabSpace Atlas turns those disconnected records into one spatially coherent system.

## What it does

LabSpace combines a professional 2D laboratory layout editor, synchronized 3D room, nested physical-storage index, inventory/equipment records, and an exact-location Spatial Index Finder. Users can design a room, place realistic laboratory assets, index a cabinet down to its shelf, drawer, compartment, or bin, and navigate directly from a deterministic project search to exact spatial evidence.

The signature workflow searches for the BÜCHI rotary evaporator, focuses its equipment record, then searches the flask set and navigates to the exact Drawer 02 location in the north reagent cabinet. Moving the equipment in 2D updates the synchronized 3D room while preserving the camera. Invalid placement is reported directly by the deterministic plan status and Warnings tab.

## How we built it

The product uses React 19 and TypeScript, React Konva for 2D, Three.js/React Three Fiber for 3D, Zustand for editor state, Zod for versioned data validation, Express for the local API, and Node SQLite for persistence. Both renderers, the Spatial Index, and the placement validator consume one canonical millimetre-based project model. Selecting an index result updates exact 2D/3D focus and evidence without duplicating scene state.

The demo requires no API key or billing because no live model provider is included. Codex/GPT-5.6 was central to the Build Week implementation process: architecture, feature delivery, asset-pipeline scripting, debugging, browser testing, regression coverage, and release documentation. A future optional LabSpace Atlas API may add model-driven intent resolution over the same trusted index and validator tools.

## Challenges

- Preserving a user's manual 3D orbit while live 2D object transforms update the scene.
- Representing cabinet sub-locations precisely without broad bench-level bounding cages.
- Keeping authored 3D assets, material-aware 2D footprints, and library thumbnails synchronized.
- Preventing startup/migration logic from overwriting a user-owned competition room.
- Keeping index evidence and placement warnings useful without inventing inventory or safety claims.

## Accomplishments

- One canonical model drives synchronized 2D, 3D, indexing, persistence, validation, and export.
- A complete source-controlled DEMO-01 showcase preserves the user's authored video room; the factory template remains only an optional copy/reset utility, and the platform stays general-purpose rather than room-specific.
- Exact evidence navigation reaches equipment and nested physical storage locations.
- The project ships authored local assets, offline decoders, tests, and a reproducible clean-clone workflow.

## What we learned

A spatial product becomes trustworthy when canonical records and deterministic services remain authoritative. The strongest demo is not the biggest asset catalog; it is a coherent loop in which design, inventory, geometry, and evidence visibly agree.

## What's next

Add an optional LabSpace Atlas API for model-driven intent selection and evidence explanation, organization accounts and permissions, scan/BIM alignment, collaborative editing, richer equipment-maintenance integrations, and measured laboratory usability studies while retaining the same canonical-data and validation boundaries.
