# Devpost draft — LabSpace AI Indexer

## Elevator pitch

Design the lab. Index every asset. Find anything instantly—in one intelligent spatial digital twin.

## Inspiration

Laboratory teams still depend on memory, spreadsheets, photographs, labels, and disconnected floor plans to answer simple operational questions: Where is the equipment? Which drawer contains its accessories? Is this new placement physically valid? LabSpace AI Indexer turns those disconnected answers into one spatially grounded system.

## What it does

LabSpace combines a professional 2D laboratory layout editor, synchronized 3D room, nested physical-storage index, inventory/equipment records, and Ask LabSpace spatial assistance. Users can design a room, place realistic laboratory assets, index a cabinet down to its shelf, drawer, compartment, or bin, and navigate directly from a natural-language question to exact spatial evidence.

The signature workflow asks where the BÜCHI rotary evaporator and its flasks are. LabSpace focuses the single equipment record, then the exact Drawer 02 location in the north reagent cabinet. Moving the equipment in 2D updates the 3D twin and spatial evidence. Asking whether the new position is safe explains actual deterministic conflicts and proposes a geometry-derived valid alternative.

## How we built it

The product uses React 19 and TypeScript, React Konva for 2D, Three.js/React Three Fiber for 3D, Zustand for editor state, Zod for versioned data validation, Express for the local API, and Node SQLite for persistence. Both renderers consume one canonical millimetre-based scene model. Ask LabSpace resolves bounded spatial intents against that model and delegates placement questions to deterministic validators before updating exact 2D/3D focus and evidence.

The demo requires no API key or billing. It is clearly labeled grounded local mode and never pretends to be a live GPT response. Codex/GPT-5.6 was central to the Build Week implementation process: architecture, feature delivery, asset-pipeline scripting, debugging, browser testing, regression coverage, and release documentation.

## Challenges

- Preserving a user's manual 3D orbit while live 2D object transforms update the scene.
- Representing cabinet sub-locations precisely without broad bench-level bounding cages.
- Keeping authored 3D assets, material-aware 2D footprints, and library thumbnails synchronized.
- Preventing startup/migration logic from overwriting a user-owned competition room.
- Making a grounded no-billing assistant useful without fabricating inventory or safety evidence.

## Accomplishments

- One canonical model drives synchronized 2D, 3D, indexing, persistence, validation, and export.
- A complete source-controlled DEMO-01 showcase preserves the user's authored video room; the factory template remains only an optional copy/reset utility, and the platform stays general-purpose rather than room-specific.
- Exact evidence navigation reaches equipment and nested physical storage locations.
- The project ships authored local assets, offline decoders, tests, and a reproducible clean-clone workflow.

## What we learned

A spatial assistant becomes trustworthy when language selects tools and records but deterministic services remain authoritative. The strongest demo is not the biggest asset catalog; it is a coherent loop in which design, inventory, geometry, and evidence visibly agree.

## What's next

Add optional hosted model intent selection, organization accounts and permissions, scan/BIM alignment, collaborative editing, richer equipment-maintenance integrations, and measured laboratory usability studies while retaining the same canonical-data and validation boundaries.
