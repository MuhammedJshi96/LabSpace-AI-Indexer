import { ROOM_ID } from "./seed";

export const BUILD_WEEK_DEMO_ID = "labspace-build-week-room-809";

export const BUILD_WEEK_DEMO_ASSET_IDS = [
  "island-bench-service-bridge",
  "lab-bench",
  "base-cabinet",
  "glazed-sliding-cabinet",
  "tall-cabinet",
  "lab-freezer",
  "stainless-wash-basin",
  "rotary-evaporator",
  "vacuum-cold-trap-system",
  "analytical-balance",
  "round-stool",
  "eyewash",
] as const;

export const BUILD_WEEK_DEMO = {
  id: BUILD_WEEK_DEMO_ID,
  name: "Build Week Demo",
  caseStudy: "Kyushu University Room 809",
  roomId: ROOM_ID,
  equipmentRecordId: "equipment-record-0005",
  flaskInventoryId: "inventory-item-0006",
  serviceScenarioRecordId: "equipment-record-0007",
  missingLocationInventoryId: "inventory-item-0004",
} as const;
