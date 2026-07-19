import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import { useEditorStore } from "../store/editor-store";

export function StatusBar() {
  const tool = useEditorStore((state) => state.tool);
  const cursor = useEditorStore((state) => state.cursor);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const gridEnabled = useEditorStore((state) => state.gridEnabled);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridSize = useEditorStore((state) => state.gridSize);
  return (
    <footer className="status-bar">
      <span>
        <b>Scale:</b> 1:60 <Info size={14} />
      </span>
      <span>
        <b>Grid:</b> {gridEnabled ? `${gridSize} mm` : "Off"}
      </span>
      <span>
        <b>Snap:</b> {snapEnabled ? "On" : "Off"}
      </span>
      <span>
        <b>Units:</b> m
      </span>
      <span>
        <b>Mode:</b> {tool === "select" ? "Edit" : tool[0].toUpperCase() + tool.slice(1)}
      </span>
      <span className="status-spacer" />
      <span className={saveStatus === "error" ? "save-error" : "save-ok"}>
        {saveStatus === "error" ? <WarningCircle size={16} /> : <CheckCircle size={16} />} {" "}
        {saveStatus === "saved"
          ? "All changes saved"
          : saveStatus === "saving"
            ? "Saving changes…"
            : "Changes pending"}
      </span>
      <span className="status-spacer status-spacer-short" />
      <span className="coordinates">
        X: {(cursor.x / 1000).toFixed(2)} m&nbsp;&nbsp; Y: {(cursor.y / 1000).toFixed(2)} m
      </span>
    </footer>
  );
}
