import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AssetPreviewPage } from "./components/AssetPreviewPage";
import { DigitalTwinPage } from "./components/DigitalTwinPage";
import { ProceduralAssetCapturePage } from "./components/ProceduralAssetCapturePage";
import "./styles.css";

const captureRoute = window.location.pathname === "/procedural-asset-capture";
const application = captureRoute ? (
  <ProceduralAssetCapturePage />
) : window.location.pathname === "/asset-preview" ? (
  <AssetPreviewPage />
) : window.location.pathname === "/digital-twin" ? (
  <DigitalTwinPage />
) : (
  <App />
);

createRoot(document.getElementById("root")!).render(
  captureRoute ? application : <React.StrictMode>{application}</React.StrictMode>,
);
