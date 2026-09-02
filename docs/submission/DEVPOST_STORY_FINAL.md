# LabSpace Atlas

> **Design the lab. Index every location. Find anything instantly.**

## Inspiration

I am a biologist, not a programmer. LabSpace Atlas started with a problem I knew from everyday laboratory work, not with an idea for a software competition.

Our laboratory is spread across several rooms and contains years of accumulated equipment, consumables, glassware, and chemicals. We often knew that something existed, but not exactly where it was. Finding it could mean opening drawers, walking between rooms, or asking the person who had used it last. That may sound like a small inconvenience, but those interruptions add up. More importantly, knowledge disappears when students graduate or responsibilities change.

I had already built a laboratory management system to bring schedules, safety workflows, equipment checks, and inventory processes together. While working on it, people in the laboratory kept returning to the same request: we needed a better way to find equipment and consumables.

At first, I imagined a searchable index. Then I asked a question that changed the whole project:

> **What if the inventory system understood the physical laboratory itself?**

An item should not only have a name and an ID. It should belong to a laboratory, a room, a work zone, a cabinet, and finally a particular shelf, drawer, compartment, or bin. The room layout and the inventory should be two views of the same reality.

That became LabSpace Atlas: a tool for designing a laboratory, indexing what is inside it, and preserving the practical knowledge that usually lives only in people's memories.

## What it does

LabSpace Atlas is a local-first laboratory layout editor and spatial index. It connects three questions that are usually handled by different tools:

1. How should this laboratory be arranged?
2. What equipment and materials do we have?
3. Where exactly is each item?

Users begin with an empty room rather than a pre-filled demonstration. They can draw and resize walls, add hosted doors and windows, choose materials, and place laboratory furniture or equipment from a searchable asset library. The 2D plan and orbitable 3D room use the same scene data, so moving an object in one view updates the other without resetting the camera.

The Inspector connects placed objects to equipment, inventory, and physical storage records. Cabinets can contain shelves, drawers, compartments, and bins, each with a stable location code. The Spatial Index Finder can search names, notes, identifiers, rooms, owners, or storage paths and then navigate to the real object or storage location in the room.

The bundled DEMO-01 room demonstrates the full workflow. Searching for `rotary evaporator` returns both the BÜCHI equipment record and its flask set. Selecting the flasks reveals the complete trail to North reagent cabinet, Drawer 02, together with the quantity, owner, evidence image, and canonical location code. An optional access preview shows the physical drawer without changing the saved room.

LabSpace also includes deterministic placement checks for boundaries, overlaps, door swings, hierarchy, and duplicate identifiers. These are geometry and data checks, not generated safety claims.

## How I built it

The most important technical decision was to keep one millimetre-based project model at the center of the application. The 2D editor, 3D room, storage hierarchy, search system, validation, persistence, and export all read from that same model. This prevents the floor plan, rendered room, and inventory database from quietly becoming different versions of the laboratory.

The application uses React and TypeScript, React Konva for the 2D planning canvas, Three.js and React Three Fiber for 3D, Zustand for editor state and history, Zod for versioned project validation, Express for the local API, and Node SQLite for persistence. Vitest, strict TypeScript checks, linting, asset validation, and production builds form the release gate.

The asset library was shaped by photographs from my university laboratory and by equipment dimensions and product references. I repeatedly corrected proportions, cabinet anatomy, materials, and details based on how these objects are actually used. The resulting assets are original, logo-free planning representations rather than certified manufacturer models.

Everything required for the demonstration is stored locally. Judges do not need an account, a paid service, an API key, or a separate asset download.

## How GPT-5.6 and Codex helped me build it

This project was a long conversation between my laboratory experience and AI-assisted development. It was not created from one prompt.

I supplied the problem, reference photographs, equipment knowledge, priorities, corrections, testing, and final product decisions. I often knew what felt wrong before I knew the programming term for it. I could say, for example, that an object jumped to the corner, that a cabinet did not resemble the reference, or that moving something made the 3D camera unusable.

GPT-5.6 helped me turn those observations into clearer workflows, data requirements, interaction rules, asset specifications, and acceptance criteria. It helped me reason about how room design, physical storage, search, validation, and evidence should fit together as one product.

Codex made those ideas tangible. It worked directly in the repository to implement features, inspect the running application, trace bugs, edit the architecture, author asset tooling, and add tests. Through many iterations it helped resolve disappearing objects, corner snapping, camera resets, stale asynchronous saves, wall and floor topology problems, renderer lifecycle failures, and inconsistent storage evidence.

For me, this was the most meaningful part of the project. I began as a biologist with a problem I cared about and no conventional programming background. Codex did not replace my judgment; it gave me a way to apply that judgment. It made software development feel learnable. With every failure I described and every correction I requested, I understood more about state, geometry, data models, testing, and product design.

The shipped application does not pretend that its deterministic search results are live GPT answers. It contains no live model provider and requires no API billing. GPT-5.6 and Codex were central to the process of building and validating LabSpace, while the runtime remains grounded in stored project data.

## Challenges

### Keeping every view in agreement

Moving one object affects more than its position. The 3D room, history, validation, saved project, selection, and searchable record must all agree. Early builds sometimes moved objects to the canvas origin, made them disappear, or reset the 3D camera. Solving those bugs forced the project to become one synchronized spatial system rather than a collection of screens.

### Indexing the exact place, not just the furniture

Highlighting a whole bench was not enough when the real answer was one drawer. LabSpace needed stable, readable location trails and canonical codes for laboratories, rooms, zones, cabinets, shelves, drawers, compartments, and bins. The evidence Inspector became the authoritative path from a search result to a physical place.

### Protecting the user's work

DEMO-01 is a user-authored room, not a disposable seed. I was worried that a migration or template update could destroy hours of arrangement work. The project therefore separates blank rooms, immutable templates, and user-owned saved rooms. Ordinary startup and code changes cannot silently overwrite the saved showcase.

### Balancing realism and performance

The first assets often looked like generic boxes. Improving them required better proportions, recognizable silhouettes, glass and metal materials, cabinet reveals, controls, and credible construction from every side. At the same time, the room had to remain responsive. Shared geometry, local compressed models, loading states, and one-model-at-a-time previews helped keep that balance.

## What I am proud of

- One project model drives the 2D plan, 3D room, indexing, validation, persistence, and export.
- Objects can be moved in 2D without losing the user's chosen 3D camera view.
- Search can move from an equipment name to exact cabinet, drawer, and inventory evidence.
- New projects begin with a genuinely empty planning canvas, while DEMO-01 remains a separate showcase.
- The catalog contains 96 planning assets, including 74 authored hero GLBs with coordinated plan and 3D representations.
- DEMO-01 contains 10 inventory records, 10 equipment records, and 15 indexed storage locations.
- The release process includes 115 automated Vitest cases across 23 files, plus linting, type checking, asset validation, and a production build.
- The complete judge workflow runs locally without an account, API key, paid service, or external asset pack.

These are repository and runtime measurements. LabSpace is still a prototype, and I do not claim unmeasured productivity improvements, safety certification, or manufacturer-accurate equipment models.

## What I learned

Before this project, many of the systems behind an application like this felt inaccessible to me. Through building LabSpace, I learned how schemas preserve saved work, how coordinate systems connect 2D and 3D, how asynchronous saves can overwrite newer changes, why camera state matters to an editor, and how a bug report can become a regression test.

I also learned that working with AI does not remove the human part of building a product. The quality of the result depended on whether I could explain the real problem, provide strong references, test honestly, reject weak solutions, and keep refining the goal. The most useful moments were not when everything worked immediately. They were the moments when something failed, I described why it failed for a laboratory user, and the next iteration taught me something new.

LabSpace changed my understanding of what I could build. It showed me that domain knowledge has value in software development, even when the person carrying that knowledge is not a programmer. With the right collaboration, I could turn years of laboratory experience into a working tool instead of leaving it as an idea.

## What's next

My first long-term goal is to connect LabSpace with the laboratory management system that inspired it. That would bring schedules, equipment records, inventory, safety workflows, and spatial evidence into one environment.

Future work could include an optional LabSpace Atlas API for grounded intent resolution, multi-user permissions, maintenance and utilization history, BIM or measured-facility alignment, richer QR navigation, utility and energy analysis, and timed usability studies measuring search-to-location performance.

The current version remains a single-user planning and indexing prototype. It is not certified safety software, a BIM authoring kernel, or a source of certified manufacturer models. I want the next phase to grow from an honest foundation rather than hide those boundaries.

What began as a request to make laboratory equipment easier to find became something more personal: proof that a biologist with a real problem, patience, and the right AI collaboration can learn to build the tool they wished existed.

> **Design the lab. Index every location. Find anything instantly.**
