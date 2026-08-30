# Inventory assignment and storage names

Inventory remains one project-wide registry. Assigning a record changes where the same item is stored; it does not duplicate stock or change quantities.

## Assign several items together

1. Open **Inventory → Assign inventory**.
2. Search and select one or more items, including items from different laboratories.
3. Choose the destination room. Browse a named cabinet, then its drawer, shelf, compartment, or bin; alternatively search storage names or location codes.
4. Check the full destination address in the footer and press **Assign items**.

**Leave unassigned** explicitly removes the exact storage assignment while retaining the inventory record in the chosen room. A batch is validated in full before anything changes. Missing locations, stale records, duplicate IDs, and protected template rooms are rejected.

For one record, use **Change location** in its Inventory details. In the Layout Editor's Inventory tab, use the location button on the item card. To start with the physical destination, select a location in the **Storage** inspector and choose **Assign inventory here**.

## Choose your own storage names

Open **Inventory → Storage names**, choose a room, select a cabinet or an internal location, then press **Rename**. The same Rename action is available directly in the Layout Editor's Storage inspector and in the assignment chooser.

Examples: `Student supplies → Pipette tips`, `Glassware cabinet → Large flasks`, or `Standards drawer → Working solutions`.

- Names must contain 1–100 characters. Names are readable labels, not unique identity keys.
- Renaming the root cabinet also renames its placed scene object. Renaming a shelf, drawer, bin, or compartment changes only that location's label.
- Canonical IDs, index codes, stock, model geometry, physical opening links, and shelf/drawer order stay unchanged.
- Inventory addresses, Spatial Index records, and the existing WebMCP location/search tools read the new labels from the canonical project. No additional agent write capability is introduced.

## Undo, persistence and review

Each batch assignment or rename creates one Undo entry. Inventory exposes Undo/Redo beside the record count; the editor uses its regular history controls. Assignment Undo restores the former room/location without restoring stale quantities or notes. History is session-local and resets on room switching or reload, as with existing editor history; saved names and assignments survive reload.

Selecting or searching a destination is read-only. **Assign items** and **Save name** are the explicit commit actions. A pending agent preview must be approved or cancelled before these operations or Undo/Redo can run. The chooser uses native modal dialogs with Escape cancellation, keyboard focus containment, and focus restoration above the application header.

## Regression coverage

- `tests/unit/inventory-organization.test.ts`: atomic cross-laboratory assignment, canonical identity, quantity-preserving history, stable physical opening anatomy, invalid/stale input, and custom-name discovery.
- `tests/e2e/inventory-organization.spec.ts`: browser batch assignment, Undo/Redo, persistence, nested naming dialogs, keyboard cancellation/focus, and compact thumbnail bounds.
