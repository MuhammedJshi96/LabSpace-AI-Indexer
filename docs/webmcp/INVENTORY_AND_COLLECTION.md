# Inventory and collection workflows

LabSpace AI Agent Twin exposes **24 WebMCP tools**. Write natural-language requests in your browser agent's chat—not inside the LabSpace inspector. The inspector shows tools, examples, execution evidence and human review.

## Add inventory

Ask: “Add 12 boxes of pipette tips to DEMO-01. Find a storage destination and let me review the entry.”

1. `labspace_inventory_locations` discovers real destinations, with room codes and cabinet/shelf/drawer paths.
2. `labspace_add_inventory` accepts 1–20 entries. Required: `roomCode`, `name`, `quantity`, `unit`. Optional: `storageLocationId`, `owner`, `notes`, `expiryDate` (`YYYY-MM-DD` or null).
3. LabSpace validates the destination and opens a **Review inventory** panel. The researcher approves or cancels. No records are created before approval; approval uses normal history and autosave.

```json
{
  "entries": [
    {
      "roomCode": "DEMO-01",
      "name": "Pipette tips, 200 µL",
      "quantity": 12,
      "unit": "boxes",
      "owner": "Shared",
      "notes": "Researcher-provided stock count"
    }
  ]
}
```

Without a storage ID the item is explicitly unassigned; LabSpace does not guess. Use an actual discovered ID to assign it. Existing `plan_inventory` → `stage_inventory_plan` remains available for agents that separate planning from review.

## Place inventory by hand

Inventory Studio starts with one searchable stock list. Open a row for its details; **Assign inventory** and **Assign selected** open the two-area Storage workspace, without a second assignment dialog.

1. Use **Choose cabinet** to select a destination in any editable room.
2. Drag an item from the inventory tray onto a named drawer or shelf. To move several records together, select their checkboxes and drag one of them.
3. For keyboard or touch, select the items, choose a map location (or the **Location** menu), then press **Place here**.
4. Undo/Redo uses the normal project history. Assignments preserve item IDs, names, quantities and other stock details, and do not move furniture or switch the editor's active room.

The map depicts storage zones above shelf boards; it is not a capacity or compatibility assessment. Unlinked custom locations stay available in the Location menu but are not invented as physical model parts. The 3D preview is optional. These are direct human edits; WebMCP inventory proposals retain their separate review requirements.

## Turn a material list into a collection guide

Ask: “Use my approved preparation list, match it against our inventory, show anything missing, then guide me through the locations I select.”

- The agent may propose a checklist based on your task, but must label suggestions and ask for the approved protocol when necessary.
- `labspace_resolve_materials` takes `{brief, materials:["Reference standards", "Nitrile gloves"]}` and checks canonical inventory/equipment across eligible rooms. It returns exact matches, review candidates, quantities/status as recorded, and missing items. Factory templates are excluded.
- The researcher chooses the relevant records. `labspace_start_collection` takes `{title, recordIds:[...]}` using those real IDs and starts an ordered itinerary.
- The visible **Collection guide** has **Previous**, **Next**, **Focus**, and **All stops**. `labspace_collection_step` offers `previous`, `next`, `status`, `finish`, and read-only `history` operations to the agent.
- The Spatial Index **Process tracker** records guide-start snapshots (names, room/path, recorded amounts), timestamped navigation and explicit human **Confirm location checked** checkpoints. Next/Previous never confirms collection, consumes stock or approves a procedure. Matching physical drawers and cabinet doors open automatically on focus; legacy mismatches have a physical-link repair path in Storage.
- History retains eight ended guides plus the active guide in this tab's session storage. Reloading the tab preserves them; this is not cloud sync, a permanent audit service or a tamper-proof log. Export JSON evidence before closing the tab. `labspace_collection_step({action:"history"})` returns only the current project's runs and cannot record a human checkpoint.
- Each stop focuses the canonical room object and storage location while retaining your chosen 2D/3D view. The guide survives navigation in the same browser tab. It does not deduct, reserve, or fabricate stock.

This is a collection checklist, **not** a validated pedestrian route, regulatory safety assessment, or authorization to run an experiment. It does not infer safe substitutions or chemical compatibility. Unlocated/deleted records fail explicitly.

## Assess a workflow and finish at a work surface

Ask: “Assess my reviewed DPPH checklist against real stock and equipment, then finish the
collection itinerary at a suitable authored work surface.”

1. `labspace_assess_workflow` accepts the researcher-supplied brief, material and equipment names,
   optional room code, work-surface preference, and bounded minimum clear area.
2. It returns exact, ambiguous, and missing index evidence plus ranked real benches/tables. Ranking
   uses authored support surfaces, mounted-equipment footprints, current placement warnings, and
   estimated clear surface area; it does not invent a protocol.
3. After review, pass the chosen material `recordIds` and returned `workspaceObjectId` to
   `labspace_start_collection`.
4. Previous/Next focuses each physical inventory location, then highlights the work surface as the
   final stop. The Spatial Index inspector presents **Ask → Ground → Collect → Decide** while the
   selected 3D bench remains visible.

The final work surface is planning evidence only—not a protocol, suitability determination,
safety-approved walking route, reservation, stock transaction, or permission to use equipment.

## Office and presentation polish

- Ctrl+D / ⌘D duplicates a selected item; Ctrl+Z undoes it. Text fields keep normal typing behavior. The Duplicate inspector button shows the shortcut.
- With Snap on, office/laboratory chairs near an open office desk, table, or computer workstation align to its working edge and tuck partly under it at floor elevation. Deep, sideways, back-facing and closed-casework intersections are not exempted from collision checks.
- Ten floor and ten wall finishes now include ivory porcelain/stone, pearl terrazzo/gloss, pale oak office finishes, graphite porcelain and sage panels. These are visual planning finishes, not certified wet-lab/fire/slip specifications.
- Updated office desk, table and workstation GLBs have open knee-space framing; the workstation adds a widescreen monitor, input devices and cable/service detail. Both catalog and plan renders are regenerated from the same models.

## Published room set

The public session seed is the explicitly exported local project in `server/public-showcase-project.json`: Laboratory 1 with DEMO-01, DEMO-02, R809, R808 and 812. It preserves local room geometry, records, IDs and finishes. The developer SQLite database is not published or changed.

New public sessions start from this snapshot and stay isolated. The local default seed and test resets remain separate. Public edits are still temporary; export JSON to keep them across service restarts. The snapshot export script makes an ignored local backup and refuses obvious private path/credential/email patterns for review.
