import type { DigitalTwinRecordKind, DigitalTwinScope } from "../domain/digital-twin-index";
import type { Project } from "../domain/schema";

export type LabSpaceReadState = {
  project: Project;
  selectedObjectIds: string[];
  selectedStorageLocationId: string | null;
};

export type LabSpaceStateReader = () => LabSpaceReadState;

export type LabContext = {
  project: { id: string; name: string };
  laboratory: { id: string; name: string; code: string };
  room: { id: string; name: string; code: string; kind: string };
  selection: { objectIds: string[]; storageLocationId: string | null };
  counts: { inventory: number; equipment: number; locations: number; alerts: number };
};

export type SearchLabRecordsInput = {
  query: string;
  scope?: DigitalTwinScope;
  kinds?: DigitalTwinRecordKind[];
  limit?: number;
};

export type LabRecordSearchResult = {
  recordId: string;
  kind: DigitalTwinRecordKind;
  name: string;
  laboratoryCode: string;
  roomCode: string;
  indexCode: string;
  path: string[];
  status: string;
};

export type SearchLabRecordsResult = {
  query: string;
  scope: DigitalTwinScope;
  totalMatches: number;
  returnedMatches: number;
  results: LabRecordSearchResult[];
};

type RecordWorkspace = {
  laboratory: { id: string; name: string; code: string };
  room: { id: string; name: string; code: string };
  indexCode: string;
  path: string[];
};

export type InventoryRecordInspection = RecordWorkspace & {
  kind: "inventory";
  recordId: string;
  name: string;
  quantity: { value: number; unit: string };
  owner: string | null;
  expiryDate: string | null;
  status: string;
  notes: string | null;
};

export type EquipmentRecordInspection = RecordWorkspace & {
  kind: "equipment";
  recordId: string;
  name: string;
  equipmentId: string;
  status: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  responsiblePerson: string | null;
  service: { lastDate: string | null; nextDate: string | null };
  utilities: {
    power: string | null;
    water: string | null;
    gas: string | null;
    drainRequired: boolean;
    ventilationRequired: boolean;
  };
  notes: string | null;
};

export type LocationRecordInspection = RecordWorkspace & {
  kind: "location";
  recordId: string;
  name: string;
  locationType: string;
  status: string;
  capacityNote: string | null;
  contents: {
    totalItems: number;
    items: Array<{ name: string; quantity: number; unit: string }>;
  };
};

export type LabRecordInspection =
  InventoryRecordInspection | EquipmentRecordInspection | LocationRecordInspection;

export type InspectLabRecordInput = { recordId: string };

export type FocusLabRecordInput = { recordId: string };

export type FocusLabRecordResult = {
  recordId: string;
  kind: DigitalTwinRecordKind;
  name: string;
  laboratoryCode: string;
  roomCode: string;
  objectId: string;
  locationId: string | null;
  path: string[];
  focused: true;
};

export type FocusLabRecordOptions = {
  revealStorage?: boolean;
};

export type LabSpaceNavigationActions = {
  focusLabRecord: (
    input: unknown,
    options?: FocusLabRecordOptions,
  ) => FocusLabRecordResult;
};

export type LabSpaceReadActions = {
  getLabContext: () => LabContext;
  searchLabRecords: (input: unknown) => SearchLabRecordsResult;
  inspectLabRecord: (input: unknown) => LabRecordInspection;
};
