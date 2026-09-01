import React from "react";
import { createRoot } from "react-dom/client";
import { ApplicationRouter } from "./ApplicationRouter";
import "./styles.css";
import "./components/WorkspacePolish.css";
import "./components/InventoryStudio.css";
import "./components/StoragePlacement.css";
import "./components/InventoryImageEditor.css";
import "./components/InspectorStudio.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApplicationRouter />
  </React.StrictMode>,
);
