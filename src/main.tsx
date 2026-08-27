import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AssetPreviewPage } from "./components/AssetPreviewPage";
import { DigitalTwinPage } from "./components/DigitalTwinPage";
import { ProceduralAssetCapturePage } from "./components/ProceduralAssetCapturePage";
import { WebMCPBridge } from "./components/WebMCPBridge";
import "./styles.css";

const captureRoute = window.location.pathname === "/procedural-asset-capture";
const webMCPRoute =
  window.location.pathname === "/" || window.location.pathname === "/digital-twin";
const application = captureRoute ? (
  <ProceduralAssetCapturePage />
) : window.location.pathname === "/asset-preview" ? (
  <AssetPreviewPage />
) : window.location.pathname === "/digital-twin" ? (
  <DigitalTwinPage />
) : (
  <App />
);
const applicationWithBridge = webMCPRoute ? (
  <>
    <WebMCPBridge />
    {application}
  </>
) : (
  application
);

createRoot(document.getElementById("root")!).render(
  captureRoute ? application : <React.StrictMode>{applicationWithBridge}</React.StrictMode>,
);
