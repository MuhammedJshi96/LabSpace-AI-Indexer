import React from "react";
import { createRoot } from "react-dom/client";
import { ApplicationRouter } from "./ApplicationRouter";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApplicationRouter />
  </React.StrictMode>,
);
