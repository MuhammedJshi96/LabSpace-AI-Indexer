import { useEffect } from "react";
import { registerLabSpaceTools } from "../webmcp/register-labspace-tools";

export function WebMCPBridge() {
  useEffect(() => {
    const registration = registerLabSpaceTools({ modelContext: document.modelContext });
    void registration.ready.catch((error: unknown) => {
      if (!registration.signal.aborted) {
        console.warn("LabSpace WebMCP tools could not be registered.", error);
      }
    });
    return registration.unregister;
  }, []);

  return null;
}
