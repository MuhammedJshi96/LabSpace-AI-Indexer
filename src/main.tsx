import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AgentReviewPanel } from "./components/AgentReviewPanel";
import { AgentActivityPanel } from "./components/AgentActivityPanel";
import { AssetPreviewPage } from "./components/AssetPreviewPage";
import { DigitalTwinPage } from "./components/DigitalTwinPage";
import { FacilityPage } from "./components/FacilityPage";
import { InventoryPage } from "./components/InventoryPage";
import { ProceduralAssetCapturePage } from "./components/ProceduralAssetCapturePage";
import { WebMCPBridge } from "./components/WebMCPBridge";
import "./styles.css";

const captureRoute = window.location.pathname === "/procedural-asset-capture";
const webMCPRoute =
  window.location.pathname === "/" ||
  window.location.pathname === "/digital-twin" ||
  window.location.pathname === "/inventory";
const application = captureRoute ? (
  <ProceduralAssetCapturePage />
) : window.location.pathname === "/asset-preview" ? (
  <AssetPreviewPage />
) : window.location.pathname === "/digital-twin" ? (
  <DigitalTwinPage />
) : window.location.pathname === "/facility" ? (
  <FacilityPage />
) : window.location.pathname === "/inventory" ? (
  <InventoryPage />
) : (
  <App />
);
const applicationWithBridge = webMCPRoute ? (
  <>
    <WebMCPBridge />
    {application}
    <AgentActivityPanel />
    <AgentReviewPanel />
  </>
) : (
  application
);

createRoot(document.getElementById("root")!).render(
  captureRoute ? application : <React.StrictMode>{applicationWithBridge}</React.StrictMode>,
);
