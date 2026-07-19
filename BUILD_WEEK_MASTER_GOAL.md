# OpenAI Build Week Master Goal — LabSpace AI

Last updated: 2026-07-18 JST

## Submission identity

- **Project:** LabSpace AI
- **Track:** Work and Productivity
- **Pitch:** “Design the lab. Index every asset. Find anything instantly—in one intelligent spatial digital twin.”
- **Positioning:** A spatial operating system connecting laboratory design, physical inventory, and AI-assisted navigation.
- **Primary Codex build-session ID:** `019f6a4d-25a9-7812-804c-88b695589b2a`

This master goal supersedes broad asset expansion as the active product priority while preserving every durable LabSpace requirement. Room 809 is the authentic competition case study, not the product boundary.

## Winning objective

Deliver a stable, coherent, screenshot-ready, judge-testable product that performs strongly in technological implementation, design, impact, and idea quality. The Codex/GPT-5.6 contribution must be central, genuine, visible, grounded, and documented.

## Core demo loop

1. Open the curated Build Week laboratory digital twin.
2. Ask: “Where is the Buchi rotary evaporator and which cabinet contains its flasks?”
3. Resolve the exact equipment and storage records, highlight both, and navigate the synchronized 2D/3D camera to them.
4. Move the equipment in the 2D editor.
5. Keep the 3D scene, spatial validation, search result, inventory location, and exact-location evidence coherent.
6. Ask: “Can I safely place it here?”
7. Explain deterministic overlap, access, clearance, elevation, wall-hosting, or utility results and suggest a valid alternative derived from actual room geometry. Never invent data.

## Execution priority

1. Stable curated competition demo.
2. Grounded GPT-5.6 Ask LabSpace assistant and exact-location navigation.
3. End-to-end reliability and focused tests.
4. Submission video and hero screenshots.
5. README, Codex evidence, Devpost copy, and judge instructions.
6. 2D/3D visual consistency and loading polish.
7. Additional assets and secondary features only after the above are strong.

## Ask LabSpace contract

Ask LabSpace is a spatial tool, not open-ended chat. It can:

- search rooms, assets, samples, equipment, cabinets, drawers, shelves, and stored notes;
- resolve natural language to canonical indexed records;
- select and focus exact items in 2D and 3D;
- explain results from the existing deterministic placement validator;
- find valid candidate positions using real room geometry;
- answer location, ownership, and maintenance questions only from stored project evidence.

Responses must label **Stored facts**, **Deterministic checks**, and **Suggestions** separately. Missing evidence is reported as missing; it is never filled with plausible-sounding inventory.

### No-billing execution mode

- The judge demo must run without an OpenAI Platform API key or per-call billing.
- The default provider is a local deterministic intent and evidence layer over the canonical Digital Twin index and placement validator.
- The UI labels this provider as `Grounded spatial evidence · local mode` and `No API billing`; documentation must never imply these local answers were generated live by GPT-5.6.
- GPT-5.6/Codex participation remains genuine and central through the primary Codex build session, which is used to design and implement the architecture, assistant tools, UI, assets, regression fixes, tests, and submission evidence.
- A future live GPT-5.6 provider is optional and must remain an intent/tool-selection layer. Canonical records and deterministic validation stay authoritative, and absence of a provider must never break the demo.

## Curated demo contract

- A visible **Build Week Demo** entry point opens a controlled Room 809 case study.
- Show roughly 15–25 best authored assets rather than the entire unfinished catalog.
- Include exact cabinet/drawer/sample/equipment records, a deliberate placement conflict, and a missing-item or maintenance scenario.
- Provide a controlled initial camera, sample prompts, explicit loading state, and a fast reset path.
- Keep the main product general-purpose and multi-laboratory.

## Reliability release gates

- No object corner snapping.
- Reliable 2D, 3D, and split mounting on a clean browser.
- Working split divider, continuous wall drawing/editing, hosted doors/windows, elevation, flips, duplicate, rotate, search, navigation, save, and reload.
- Port 3004 remains the local demo host.
- Focused automated tests cover the end-to-end competition flow and high-risk renderer/drag/persistence paths.

## Submission deliverables

- Judge-accessible working demo and concise testing instructions.
- Devpost draft covering problem, solution, workflow, implementation, impact, challenges, accomplishments, lessons, and next steps.
- README sections for before/after Build Week, Codex/GPT-5.6 contributions, user decisions, architecture, setup, tests, limitations, licensing/originality, privacy, and `/feedback` session evidence.
- Hero screenshots, optional short animated capture, and an architecture visual showing natural language → GPT-5.6/tool selection → deterministic room/inventory services → synchronized focus/validation.
- A locally prepared sub-three-minute narrated video plan; no upload or external publication without explicit approval.

## Evidence and impact

Measure or derive transparently:

- search-to-location time in the curated demo;
- indexed asset, equipment, storage-location, and inventory counts;
- deliberate conflict types detected by the validator;
- any small usability run completed.

Never present estimates as measured outcomes.

## External-action boundary

Prepare all competition materials locally. Do not deploy, publish, submit, upload to YouTube, create public access, or send content without explicit user approval.
