import { useEffect } from "react";
import { DownloadSimple, WarningCircle } from "@phosphor-icons/react";
import { useEditorStore } from "../store/editor-store";
import { exportProjectJson } from "../lib/exports";
import "./ProjectSaveLifecycle.css";

/** One route-independent browser saver. Never persist a provisional agent preview. */
export function ProjectSaveLifecycle() {
  const mode = useEditorStore((state) => state.persistenceMode);
  const error = useEditorStore((state) => state.saveError);
  useEffect(() => {
    let queued = false;
    let mounted = true;
    const flush = () => {
      const state = useEditorStore.getState();
      if (
        state.hydrated &&
        state.persistenceMode === "browser" &&
        state.saveStatus === "unsaved" &&
        !state.pendingAgentChange
      )
        void state.saveNow();
    };
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (
        queued ||
        !state.hydrated ||
        state.persistenceMode !== "browser" ||
        state.saveStatus !== "unsaved" ||
        state.pendingAgentChange
      )
        return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (mounted) flush();
      });
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const state = useEditorStore.getState();
      if (!state.hydrated || state.persistenceMode !== "browser" || state.saveStatus === "saved")
        return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", flush);
    flush();
    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  if (mode !== "browser" || !error) return null;
  return (
    <aside className="project-save-warning" role="alert" aria-label="Project save needs attention">
      <WarningCircle size={22} />
      <div>
        <strong>Your project needs attention</strong>
        <p>{error}</p>
        <button onClick={() => exportProjectJson(useEditorStore.getState().project)}>
          <DownloadSimple size={17} /> Export this tab's project
        </button>
      </div>
    </aside>
  );
}
