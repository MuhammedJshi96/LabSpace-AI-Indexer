import { useEffect, useState } from "react";
import { App } from "./App";
import { AgentReviewPanel } from "./components/AgentReviewPanel";
import { AgentActivityPanel } from "./components/AgentActivityPanel";
import { AssetPreviewPage } from "./components/AssetPreviewPage";
import { DigitalTwinPage } from "./components/DigitalTwinPage";
import { FacilityPage } from "./components/FacilityPage";
import { InventoryPage } from "./components/InventoryPage";
import { ProceduralAssetCapturePage } from "./components/ProceduralAssetCapturePage";
import { WebMCPBridge } from "./components/WebMCPBridge";
import { CollectionGuide } from "./components/CollectionGuide";

export function ApplicationRouter() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const captureRoute = path === "/procedural-asset-capture";
  const webMCPRoute = path === "/" || path === "/digital-twin" || path === "/inventory";
  const application = captureRoute ? (
    <ProceduralAssetCapturePage />
  ) : path === "/asset-preview" ? (
    <AssetPreviewPage />
  ) : path === "/digital-twin" ? (
    <DigitalTwinPage />
  ) : path === "/facility" ? (
    <FacilityPage />
  ) : path === "/inventory" ? (
    <InventoryPage />
  ) : (
    <App />
  );
  const applicationWithBridge = webMCPRoute ? (
    <>
      <WebMCPBridge />
      {application}
      {path !== "/digital-twin" && <CollectionGuide />}
      <AgentActivityPanel />
      <AgentReviewPanel />
    </>
  ) : (
    application
  );

  return captureRoute ? application : applicationWithBridge;
}
