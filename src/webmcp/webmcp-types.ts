import type {
  LabSpaceNavigationActions,
  LabSpaceLayoutActions,
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
  spatialActions?: LabSpaceSpatialActions;
  stagingActions?: LabSpaceStagingActions;
};
