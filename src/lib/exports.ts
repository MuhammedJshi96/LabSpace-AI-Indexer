import type { Project, Room, Scene } from "../domain/schema";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

export function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportProjectJson(project: Project) {
  downloadText(
    `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`,
    JSON.stringify(project, null, 2),
    "application/json",
  );
}

export function equipmentCsv(room: Room) {
  const rows: unknown[][] = [
    [
      "Index code",
      "Equipment ID",
      "Name",
      "Manufacturer",
      "Model",
      "Serial number",
      "Status",
      "Responsible person",
      "Next service",
      "X mm",
      "Y mm",
    ],
  ];
  for (const record of room.scene.equipmentRecords) {
    const object = room.scene.objects.find((entry) => entry.id === record.objectId);
    rows.push([
      object?.indexCode,
      record.equipmentId,
      record.name,
      record.manufacturer,
      record.model,
      record.serialNumber,
      record.status,
      record.responsiblePerson,
      record.nextServiceDate,
      object?.position.x,
      object?.position.y,
    ]);
  }
  return csv(rows);
}

export function locationsCsv(room: Room) {
  const occupied = new Set(
    room.scene.inventoryItems.map((item) => item.storageLocationId).filter(Boolean),
  );
  const rows: unknown[][] = [
    ["Index code", "Location name", "Type", "Parent code", "Object", "Status", "Contents count"],
  ];
  for (const location of room.scene.storageLocations) {
    const parent = room.scene.storageLocations.find((entry) => entry.id === location.parentId);
    const object = room.scene.objects.find((entry) => entry.id === location.objectId);
    rows.push([
      location.indexCode,
      location.name,
      location.type,
      parent?.indexCode ?? "",
      object?.name ?? "",
      occupied.has(location.id) ? "Occupied" : "Empty",
      room.scene.inventoryItems.filter((item) => item.storageLocationId === location.id).length,
    ]);
  }
  return csv(rows);
}

export function inventoryCsv(scene: Scene, unassignedOnly = false) {
  const rows: unknown[][] = [
    ["Item", "Quantity", "Unit", "Owner", "Expiry date", "Location code", "Notes"],
  ];
  for (const item of scene.inventoryItems.filter(
    (entry) => !unassignedOnly || !entry.storageLocationId,
  )) {
    const location = scene.storageLocations.find((entry) => entry.id === item.storageLocationId);
    rows.push([
      item.name,
      item.quantity,
      item.unit,
      item.owner,
      item.expiryDate ?? "",
      location?.indexCode ?? "Unassigned",
      item.notes,
    ]);
  }
  return csv(rows);
}

export function hierarchyCsv(room: Room) {
  const rows: unknown[][] = [
    ["Level", "Index code", "Name", "Type", "Parent", "Room", "Inventory items"],
  ];
  const walk = (parentId: string | null, level: number) => {
    for (const location of room.scene.storageLocations
      .filter((entry) => entry.parentId === parentId)
      .sort((a, b) => a.order - b.order)) {
      const parent = room.scene.storageLocations.find((entry) => entry.id === location.parentId);
      rows.push([
        level,
        location.indexCode,
        location.name,
        location.type,
        parent?.indexCode ?? "",
        room.code,
        room.scene.inventoryItems
          .filter((item) => item.storageLocationId === location.id)
          .map((item) => item.name)
          .join("; "),
      ]);
      walk(location.id, level + 1);
    }
  };
  walk(null, 0);
  return csv(rows);
}
