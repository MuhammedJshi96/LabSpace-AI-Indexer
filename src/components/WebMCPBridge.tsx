import { useEffect } from "react";
import { agentActivityActions } from "../agent/agent-activity-store";
import { registerLabSpaceTools } from "../webmcp/register-labspace-tools";

export function WebMCPBridge() {
  useEffect(() => {
    if (!document.modelContext) {
      agentActivityActions.setBridgeState(
        "unavailable",
        [],
        "Open LabSpace in a WebMCP-capable browser to expose its agent tools.",
      );
      return;
    }
    const registration = registerLabSpaceTools({ modelContext: document.modelContext });
    const toolNames = registration.tools.map((tool) => tool.name);
    agentActivityActions.setBridgeState("registering", toolNames);
    void registration.ready
      .then(() => {
        if (!registration.signal.aborted) {
          agentActivityActions.setBridgeState("ready", toolNames);
        }
      })
      .catch((error: unknown) => {
        if (!registration.signal.aborted) {
          agentActivityActions.setBridgeState(
            "error",
            [],
            "LabSpace could not register its WebMCP tools in this browser.",
          );
          console.warn("LabSpace WebMCP tools could not be registered.", error);
        }
      });
    return registration.unregister;
  }, []);

  return null;
}
