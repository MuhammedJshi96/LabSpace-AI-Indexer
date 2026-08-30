# Inventory and Storage workspaces

Inventory remains one project-wide registry. Assigning a record changes where the same item is stored; it does not duplicate stock or change quantities.

## Work with storage at full size

Open **Inventory → Storage**. This is a full workspace, not another Inspector panel:

1. Find a cabinet or bench in the left rail. Search matches room/laboratory names, location labels, codes and stored item names.
2. Select a numbered drawer or shelf on the central **Storage map**, or use the complete **Locations** directory below it. Opposing and corner faces have their own views; compartments reveal their internal shelves.
3. Rename the selected location with its pencil. The right panel shows its exact contents with quantities and units. A root cabinet shows the contents of the whole unit and links to each item's exact location.
4. **Assign items** moves existing records through the reviewed assignment dialog. **Add item** creates a new record at this location only after submitting the name, quantity and unit. Click an item name to edit all its details in Inventory.
5. Optional **3D access preview** uses the existing authored asset and materials. It starts closed. **Show access preview** opens only the verified mechanism. Its orbit, fit and opening state do not change the live room or editor camera.

**Advanced details** keeps index codes, capacity notes, physical access bindings, custom nested locations and removal out of the daily assignment workflow. Removing a location requires confirmation and keeps stock as unassigned records. Storage setup remains an explicit, additive action; browsing never repairs or rewrites user data automatically.

The existing label preview and reviewed room reindexing remain available under **Advanced details → Labels and room codes**. These explicitly open the selected room in the Layout Editor; printing or reindexing still requires its existing final action.

The editor's **Storage** Inspector now contains a brief summary and **Manage storage**. It opens the full workspace at the selected cabinet/shelf. **Back to layout** returns to the original editor selection, pan/zoom and saved camera without a document reload. **Show this location in layout** intentionally selects the browsed location instead. Browsing another laboratory in Storage does not switch the active editor room.

## Assign several items together

1. Open **Inventory** and check the rows you want to move. Press **Assign selected**. Alternatively, open **Assign inventory** and choose items there, including items from different laboratories.
2. Choose the destination room and select a cabinet thumbnail.
3. Click a numbered drawer or compartment on its **Visual** storage map. A compartment opens its interior shelf map. For two-sided or corner casework, choose the appropriate face. The selected location and its existing contents appear below.
4. Check the full destination address in the footer and press **Assign items**. Browsing and selecting alone do not move stock.

The map is an object-local elevation derived from the asset's delivered storage anatomy, not a guessed illustration or a room-position map. Only uniquely linked canonical locations are assignable from it. Custom bins, unlinked legacy locations, and assets without verified anatomy remain available through the searchable storage list; no records or physical links are created automatically. The **List** view remains available for name-first browsing.

Inventory rows show the item image when available, name, laboratory/room, storage trail, quantity, unit and assignment state. An inferred catalog reference is labelled as such in its tooltip; it is not presented as photographic evidence of the specific stock. Checkboxes select a batch independently of the row opened in the inspector. **Select all matching inventory** follows the current filters. A selected item hidden by a later filter stays selected, with an explicit hidden-selection count; use **Clear selection** to start again.

**Leave unassigned** explicitly removes the exact storage assignment while retaining the inventory record in the chosen room. A batch is validated in full before anything changes. Missing locations, stale records, duplicate IDs, and protected template rooms are rejected.

For one record, use **Change location** in its Inventory details. In the Layout Editor's Inventory tab, use the location button on the item card. To start with the physical destination, use **Storage → Manage storage → Assign items**.

## Choose your own storage names

Open **Inventory → Storage**, select a cabinet or an internal location, then press the pencil beside its name. Edit the name in place and press **Save name** or Enter. **Cancel** or Escape discards the draft. There is no second naming dialog.

The same inline action is available beside the cabinet name on the visual map and under **Name this storage** in the selected inventory record's details. That last option exposes every label along the item's address, so a cabinet and its shelf can be named without navigating away.

Examples: `Student supplies → Pipette tips`, `Glassware cabinet → Large flasks`, or `Standards drawer → Working solutions`.

- Names must contain 1–100 characters. Names are readable labels, not unique identity keys.
- Renaming the root cabinet also renames its placed scene object. Renaming a shelf, drawer, bin, or compartment changes only that location's label.
- Canonical IDs, index codes, stock, model geometry, physical opening links, and shelf/drawer order stay unchanged.
- Inventory addresses, Spatial Index records, and the existing WebMCP location/search tools read the new labels from the canonical project. No additional agent write capability is introduced.

## Undo, persistence and review

Each batch assignment, rename or storage configuration action creates one Undo entry. The workspace exposes Undo/Redo; the editor uses its regular history controls. Assignment and storage Undo preserve newer stock quantities and notes. Room-scoped storage history targets the correct room without changing the active editor room. History is session-local and resets on room switching or reload, as with existing editor history; saved names and assignments survive reload in the local SQLite project.

**Public saving:** The online app saves the complete project and named room versions to this browser's IndexedDB. Wait for **Saved in this browser**; refreshes, server restarts and deployments then reopen that copy without reseeding it. Clearing site data, private-browsing cleanup or changing browsers/devices does not retain the copy: use **Export project** for a portable backup. A stale tab is blocked from overwriting a newer saved project. Never replace an online workspace with a local project or starter snapshot during deployment.

Selecting or searching a destination is read-only. **Assign items** and **Save name** are the explicit commit actions. A pending agent preview must be approved or cancelled before these operations or Undo/Redo can run. The chooser uses native modal dialogs with Escape cancellation, keyboard focus containment, and focus restoration above the application header.

## Regression coverage

- `tests/unit/inventory-organization.test.ts`: atomic cross-laboratory assignment, canonical identity, quantity-preserving history, stable physical opening anatomy, invalid/stale input, and custom-name discovery.
- `tests/unit/storage-map.test.ts`: all verified storage families, opposing and corner faces, transform/name independence, and safe handling of missing or ambiguous bindings.
- `tests/unit/storage-workspace.test.ts`: room-scoped storage changes, editor-context preservation, stock-preserving undo, pending-agent guards and template protection.
- `tests/e2e/inventory-organization.spec.ts`: browser batch assignment, exact map-selected IDs, stock/geometry preservation, Undo/Redo, persistence, inline naming, keyboard cancellation/focus, custom-location fallback, and compact layouts.
