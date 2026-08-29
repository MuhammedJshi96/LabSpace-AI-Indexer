import type {
  LabSpaceNavigationActions,
  LabSpaceLayoutActions,
  LabSpaceInventoryActions,
  LabSpaceReadActions,
  LabSpaceSpatialActions,
  LabSpaceStagingActions,
} from "../agent/labspace-action-types";

export type LabSpaceToolRegistration = {
  tools: WebMCP.ModelContextTool[];
  signal: AbortSignal;
  ready: Promise<void>;
  unregister: () => void;
};

export type RegisterLabSpaceToolsOptions = {
  modelContext?: WebMCP.ModelContext;
  actions?: LabSpaceReadActions;
  navigationActions?: LabSpaceNavigationActions;
  layoutActions?: LabSpaceLayoutActions;
  inventoryActions?: LabSpaceInventoryActions;
  spatialActions?: LabSpaceSpatialActions;
  stagingActions?: LabSpaceStagingActions;
};
