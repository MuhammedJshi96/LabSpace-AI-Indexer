import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Archive,
  ArrowRight,
  ArrowCounterClockwise,
  Buildings,
  CaretDown,
  Check,
  Copy,
  Database,
  DoorOpen,
  DownloadSimple,
  FileCsv,
  FilePlus,
  FloppyDisk,
  GearSix,
  GridFour,
  Keyboard,
  Package,
  PencilSimple,
  Plus,
  Printer,
  Question,
  Ruler,
  Star,
  Trash,
  TreeStructure,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { previewReindex } from "../domain/indexing";
import { createBlankProject } from "../domain/room-factory";
import type { RoomVersion, StorageLocation } from "../domain/schema";
import { deleteLocalProject, importProject } from "../lib/api";
import {
  downloadText,
  equipmentCsv,
  exportProjectJson,
  hierarchyCsv,
  inventoryCsv,
  locationsCsv,
} from "../lib/exports";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";

function Modal({
  title,
  eyebrow,
  children,
  wide = false,
  printClass = "",
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  wide?: boolean;
  printClass?: string;
}) {
  const setDialog = useEditorStore((state) => state.setDialog);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setDialog(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [setDialog]);
  return (
    <div
      className={`modal-backdrop ${printClass}`}
      onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}
    >
      <section
        className={`modal-card ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button onClick={() => setDialog(null)} aria-label="Close dialog">
            <X size={19} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function ProjectDialog() {
  const project = useEditorStore((state) => state.project);
  const room = useEditorStore(selectActiveRoom);
  const renameProject = useEditorStore((state) => state.renameProject);
  const renameLaboratory = useEditorStore((state) => state.renameLaboratory);
  const renameRoom = useEditorStore((state) => state.renameRoom);
  const replaceProject = useEditorStore((state) => state.replaceProject);
  const switchRoom = useEditorStore((state) => state.switchRoom);
  const createLaboratory = useEditorStore((state) => state.createLaboratory);
  const createRoom = useEditorStore((state) => state.createRoom);
  const deleteRoom = useEditorStore((state) => state.deleteRoom);
  const duplicateRoom = useEditorStore((state) => state.duplicateRoom);
  const createDemoFromTemplate = useEditorStore((state) => state.createDemoFromTemplate);
  const resetActiveDemoFromTemplate = useEditorStore((state) => state.resetActiveDemoFromTemplate);
  const saveNow = useEditorStore((state) => state.saveNow);
  const browserSave = useEditorStore((state) => state.persistenceMode === "browser");
  const setDialog = useEditorStore((state) => state.setDialog);
  const pushToast = useEditorStore((state) => state.pushToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedLaboratoryId, setSelectedLaboratoryId] = useState(room.laboratoryId);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState<
    | null
    | "rename-project"
    | "create-laboratory"
    | "create-room"
    | "rename-laboratory"
    | "rename-room"
  >(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(project.name);
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [laboratoryName, setLaboratoryName] = useState("");
  const [laboratoryCode, setLaboratoryCode] = useState("");
  const selectedLaboratory =
    project.laboratories.find((laboratory) => laboratory.id === selectedLaboratoryId) ??
    project.laboratories[0];
  const visibleRooms = project.rooms.filter((entry) => entry.roomKind !== "demo-template");

  const closeWorkspaceForm = () => {
    setWorkspaceForm(null);
    setEditingId(null);
  };

  const openCreateLaboratory = () => {
    setCreateMenuOpen(false);
    setLaboratoryName("");
    setLaboratoryCode("");
    setRoomName("");
    setRoomCode("");
    setWorkspaceForm("create-laboratory");
  };

  const openCreateRoom = () => {
    setCreateMenuOpen(false);
    setRoomName("");
    setRoomCode("");
    setWorkspaceForm("create-room");
  };

  const openRenameLaboratory = (laboratoryId: string) => {
    const laboratory = project.laboratories.find((entry) => entry.id === laboratoryId);
    if (!laboratory) return;
    setCreateMenuOpen(false);
    setSelectedLaboratoryId(laboratory.id);
    setEditingId(laboratory.id);
    setLaboratoryName(laboratory.name);
    setLaboratoryCode(laboratory.code);
    setWorkspaceForm("rename-laboratory");
  };

  const openRenameRoom = (roomId: string) => {
    const entry = project.rooms.find((candidate) => candidate.id === roomId);
    if (!entry || entry.roomKind === "demo-template") return;
    setCreateMenuOpen(false);
    setSelectedLaboratoryId(entry.laboratoryId);
    setEditingId(entry.id);
    setRoomName(entry.name);
    setRoomCode(entry.code);
    setWorkspaceForm("rename-room");
  };

  const persistWorkspaceUpdate = () => {
    window.setTimeout(() => void useEditorStore.getState().saveNow(), 0);
  };

  const newProject = () => {
    if (
      browserSave &&
      !window.confirm(
        "Start a new workspace? Export your current project first if you want to keep a portable copy. This replaces the active project in this browser.",
      )
    )
      return;
    replaceProject(createBlankProject());
    setDialog(null);
    pushToast("New professional laboratory project created.", "success");
  };

  const duplicateProject = () => {
    const copy = structuredClone(project);
    copy.id = crypto.randomUUID();
    copy.name = `${project.name} copy`;
    copy.laboratories = copy.laboratories.map((lab) => ({ ...lab, projectId: copy.id }));
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    replaceProject(copy);
    setDialog(null);
    pushToast("Project duplicated as a new local record.", "success");
  };

  const workspaceFormTitle =
    workspaceForm === "rename-project"
      ? "Rename project"
      : workspaceForm === "create-laboratory"
        ? "Create laboratory"
        : workspaceForm === "create-room"
          ? "Create room"
          : workspaceForm === "rename-laboratory"
            ? "Rename laboratory"
            : "Rename room";

  const submitWorkspaceForm = () => {
    if (workspaceForm === "rename-project") {
      const nextName = projectName.trim();
      if (!nextName) {
        pushToast("Project name is required.", "error");
        return;
      }
      renameProject(nextName);
      pushToast("Project name updated.", "success");
      persistWorkspaceUpdate();
      closeWorkspaceForm();
      return;
    }
    if (workspaceForm === "create-laboratory") {
      const id = createLaboratory({
        name: laboratoryName,
        code: laboratoryCode,
        roomName,
        roomCode,
      });
      if (!id) return;
      setSelectedLaboratoryId(id);
      persistWorkspaceUpdate();
      closeWorkspaceForm();
      return;
    }
    if (workspaceForm === "create-room") {
      const id = createRoom({
        laboratoryId: selectedLaboratory?.id,
        name: roomName,
        code: roomCode,
      });
      if (!id) return;
      persistWorkspaceUpdate();
      closeWorkspaceForm();
      return;
    }
    if (workspaceForm === "rename-laboratory" && editingId) {
      if (!renameLaboratory(editingId, laboratoryName, laboratoryCode)) return;
      persistWorkspaceUpdate();
      closeWorkspaceForm();
      return;
    }
    if (workspaceForm === "rename-room" && editingId) {
      if (!renameRoom(editingId, roomName, roomCode)) return;
      persistWorkspaceUpdate();
      closeWorkspaceForm();
    }
  };

  return (
    <Modal title="Laboratories and rooms" eyebrow="Project workspace" wide>
      <div className="project-hero project-hero-manager">
        <img src="/labspace-mark.svg" alt="" />
        <div>
          <b>{project.name}</b>
          <span>
            {project.laboratories.length} laborator
            {project.laboratories.length === 1 ? "y" : "ies"} · {visibleRooms.length} room
            {visibleRooms.length === 1 ? "" : "s"} ·{" "}
            {browserSave ? "Saved in this browser" : "Local project"}
          </span>
        </div>
        <button
          className="workspace-quiet-action"
          onClick={() => {
            setProjectName(project.name);
            setWorkspaceForm("rename-project");
          }}
        >
          <PencilSimple size={16} /> Rename project
        </button>
      </div>
      <div className="project-workspace-toolbar">
        <span>
          <b>Facility structure</b>
          <small>Open, rename, or remove rooms from one organized workspace.</small>
        </span>
        <div className="project-workspace-actions">
          <a href="/facility">
            <GridFour size={17} /> Facility map
          </a>
          <div className="workspace-create-control">
            <button
              className="workspace-create-button"
              onClick={() => setCreateMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={createMenuOpen}
            >
              <Plus size={17} weight="bold" /> Create <CaretDown size={14} />
            </button>
            {createMenuOpen && (
              <div className="workspace-create-menu" role="menu">
                <button role="menuitem" onClick={openCreateLaboratory}>
                  <Buildings size={19} weight="duotone" />
                  <span>
                    <b>Laboratory</b>
                    <small>Create a facility group with its first blank room.</small>
                  </span>
                </button>
                <button role="menuitem" onClick={openCreateRoom}>
                  <DoorOpen size={19} weight="duotone" />
                  <span>
                    <b>Room</b>
                    <small>Add a blank planning canvas to a laboratory.</small>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="project-workspace-grid">
        <section className="project-room-browser" aria-label="Project laboratories and rooms">
          <div className="project-section-heading">
            <span>
              <b>Project navigator</b>
              <small>Switch between every laboratory and room</small>
            </span>
            <em>
              {visibleRooms.length} room{visibleRooms.length === 1 ? "" : "s"}
            </em>
          </div>
          <div className="project-laboratory-list">
            {project.laboratories.map((laboratory) => {
              const rooms = project.rooms.filter(
                (entry) =>
                  entry.roomKind !== "demo-template" &&
                  (entry.laboratoryId === laboratory.id || laboratory.roomIds.includes(entry.id)),
              );
              const selected = selectedLaboratory?.id === laboratory.id;
              return (
                <article key={laboratory.id} className={selected ? "selected-laboratory" : ""}>
                  <div className="laboratory-heading-row">
                    <button
                      className="laboratory-heading"
                      onClick={() => setSelectedLaboratoryId(laboratory.id)}
                      aria-pressed={selected}
                    >
                      <span>
                        <b>{laboratory.name}</b>
                        <small>{laboratory.code}</small>
                      </span>
                      <em>
                        {rooms.length} room{rooms.length === 1 ? "" : "s"}
                      </em>
                    </button>
                    <button
                      className="project-identity-edit"
                      onClick={() => openRenameLaboratory(laboratory.id)}
                      aria-label={`Rename ${laboratory.name}`}
                      title={`Rename ${laboratory.name}`}
                    >
                      <PencilSimple size={16} />
                    </button>
                  </div>
                  <div className="project-room-list">
                    {rooms.map((entry) => (
                      <div
                        className={`project-room-row${entry.id === project.activeRoomId ? " active" : ""}`}
                        key={entry.id}
                      >
                        <button
                          className="project-room-select"
                          aria-current={entry.id === project.activeRoomId ? "page" : undefined}
                          onClick={() => switchRoom(entry.id)}
                        >
                          <span>
                            <b>{entry.name}</b>
                            <small>{entry.code}</small>
                          </span>
                          <em>{entry.scene.objects.length} items</em>
                        </button>
                        <button
                          className="project-room-edit"
                          aria-label={`Rename ${entry.name}`}
                          title={`Rename ${entry.name}`}
                          onClick={() => openRenameRoom(entry.id)}
                        >
                          <PencilSimple size={16} />
                        </button>
                        <button
                          className="project-room-delete"
                          aria-label={`Delete ${entry.name}`}
                          title={`Delete ${entry.name}`}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete ${entry.name}? Its layout, indexing records, and unsaved room state will be removed from this project.`,
                              )
                            )
                              return;
                            if (deleteRoom(entry.id)) {
                              window.setTimeout(() => void useEditorStore.getState().saveNow(), 0);
                            }
                          }}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    ))}
                    {!rooms.length && <p>No rooms in this laboratory yet.</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="project-selection-card" aria-label="Selected laboratory summary">
          <span className="eyebrow">Selected laboratory</span>
          <Buildings size={30} weight="duotone" />
          <div>
            <h3>{selectedLaboratory?.name ?? "No laboratory selected"}</h3>
            <code>{selectedLaboratory?.code ?? "—"}</code>
          </div>
          <dl>
            <div>
              <dt>Rooms</dt>
              <dd>
                {
                  visibleRooms.filter((entry) => entry.laboratoryId === selectedLaboratory?.id)
                    .length
                }
              </dd>
            </div>
            <div>
              <dt>Active room</dt>
              <dd>{room.laboratoryId === selectedLaboratory?.id ? room.code : "—"}</dd>
            </div>
          </dl>
          <p>
            Rooms share one facility workspace while keeping independent layouts, inventories, and
            spatial indexes.
          </p>
          {selectedLaboratory && (
            <button
              className="workspace-quiet-action"
              onClick={() => openRenameLaboratory(selectedLaboratory.id)}
            >
              <PencilSimple size={16} /> Rename laboratory
            </button>
          )}
          <a href="/facility">
            <GridFour size={17} /> Open facility map
          </a>
        </aside>
      </div>
      {workspaceForm && (
        <div
          className="workspace-subdialog-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && closeWorkspaceForm()}
        >
          <section
            className="workspace-subdialog"
            role="dialog"
            aria-modal="true"
            aria-label={workspaceFormTitle}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              closeWorkspaceForm();
            }}
          >
            <header>
              <span>
                <small>Project workspace</small>
                <h3>{workspaceFormTitle}</h3>
              </span>
              <button onClick={closeWorkspaceForm} aria-label={`Close ${workspaceFormTitle}`}>
                <X size={18} />
              </button>
            </header>
            <div className="workspace-subdialog-body">
              {workspaceForm === "rename-project" && (
                <label className="dialog-field">
                  <span>Project name</span>
                  <input
                    autoFocus
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                  />
                </label>
              )}
              {(workspaceForm === "create-laboratory" || workspaceForm === "rename-laboratory") && (
                <>
                  <div className="project-field-pair">
                    <label className="dialog-field">
                      <span>Laboratory name</span>
                      <input
                        autoFocus
                        value={laboratoryName}
                        onChange={(event) => setLaboratoryName(event.target.value)}
                        placeholder={
                          workspaceForm === "create-laboratory" ? "Generated if blank" : undefined
                        }
                      />
                    </label>
                    <label className="dialog-field">
                      <span>Laboratory code</span>
                      <input
                        value={laboratoryCode}
                        onChange={(event) => setLaboratoryCode(event.target.value)}
                        placeholder={workspaceForm === "create-laboratory" ? "LAB-02" : undefined}
                      />
                    </label>
                  </div>
                  {workspaceForm === "create-laboratory" && (
                    <fieldset className="workspace-first-room-fields">
                      <legend>First blank room</legend>
                      <p>Every laboratory starts with one editable planning canvas.</p>
                      <div className="project-field-pair">
                        <label className="dialog-field">
                          <span>Room name</span>
                          <input
                            value={roomName}
                            onChange={(event) => setRoomName(event.target.value)}
                            placeholder="Room 1"
                          />
                        </label>
                        <label className="dialog-field">
                          <span>Room code</span>
                          <input
                            value={roomCode}
                            onChange={(event) => setRoomCode(event.target.value)}
                            placeholder="R001"
                          />
                        </label>
                      </div>
                    </fieldset>
                  )}
                </>
              )}
              {(workspaceForm === "create-room" || workspaceForm === "rename-room") && (
                <>
                  {workspaceForm === "create-room" && (
                    <label className="dialog-field">
                      <span>Laboratory</span>
                      <select
                        autoFocus
                        value={selectedLaboratory?.id ?? ""}
                        onChange={(event) => setSelectedLaboratoryId(event.target.value)}
                      >
                        {project.laboratories.map((laboratory) => (
                          <option key={laboratory.id} value={laboratory.id}>
                            {laboratory.name} · {laboratory.code}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="project-field-pair">
                    <label className="dialog-field">
                      <span>Room name</span>
                      <input
                        autoFocus={workspaceForm === "rename-room"}
                        value={roomName}
                        onChange={(event) => setRoomName(event.target.value)}
                        placeholder={
                          workspaceForm === "create-room" ? "Generated if blank" : undefined
                        }
                      />
                    </label>
                    <label className="dialog-field">
                      <span>Room code</span>
                      <input
                        value={roomCode}
                        onChange={(event) => setRoomCode(event.target.value)}
                        placeholder={workspaceForm === "create-room" ? "R001" : undefined}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
            <footer>
              <button onClick={closeWorkspaceForm}>Cancel</button>
              <button className="primary-action" onClick={submitWorkspaceForm}>
                {workspaceForm.startsWith("create") ? <Plus size={17} /> : <Check size={17} />}
                {workspaceForm.startsWith("create") ? "Create" : "Save changes"}
              </button>
            </footer>
          </section>
        </div>
      )}
      <div className="project-section-heading project-data-heading">
        <span>
          <b>Project data</b>
          <small>Create, exchange, and version the complete indexed project</small>
        </span>
      </div>
      {browserSave && (
        <section className="browser-save-explanation" aria-label="How your project is saved">
          <strong>Automatic saving · This browser and device</strong>
          <p>
            Your laboratories, rooms, layouts, inventory and named room versions stay saved here
            across refreshes and site updates. Wait for “Saved in this browser” before closing the
            tab.
          </p>
          <p>
            Use <b>Export project</b> for a portable backup, and <b>Open JSON</b> to bring it to
            another browser or computer. Clearing site data or closing a private-browsing session
            removes its saved copy. This is not cloud or account sync.
          </p>
        </section>
      )}
      <div className="dialog-action-grid">
        <button onClick={newProject}>
          <FilePlus size={19} />
          <span>
            <b>New project</b>Start with an empty indexed room
          </span>
        </button>
        <button onClick={() => fileRef.current?.click()}>
          <UploadSimple size={19} />
          <span>
            <b>Open JSON</b>Import a portable project file
          </span>
        </button>
        <button onClick={duplicateProject}>
          <Copy size={19} />
          <span>
            <b>Duplicate project</b>Create a separate local copy
          </span>
        </button>
        <button onClick={() => exportProjectJson(project)}>
          <DownloadSimple size={19} />
          <span>
            <b>Export project</b>Download versioned JSON
          </span>
        </button>
        <button onClick={() => setDialog("demos")}>
          <Star size={19} />
          <span>
            <b>Demo Manager</b>Save, duplicate, feature, and open presentation rooms
          </span>
        </button>
        <button
          data-testid="open-build-week-demo"
          onClick={() => {
            const id = createDemoFromTemplate();
            if (id) window.setTimeout(() => void useEditorStore.getState().saveNow(), 0);
          }}
        >
          <Database size={19} />
          <span>
            <b>Create demo from template</b>Make an editable, independently saved competition room
          </span>
        </button>
        {room.roomKind === "demo" && (
          <button
            onClick={() => {
              if (
                !window.confirm(
                  "Reset this saved Demo Room from the factory template? Its current room geometry, assets, index, and saved view will be replaced.",
                )
              )
                return;
              if (resetActiveDemoFromTemplate()) {
                window.setTimeout(() => void useEditorStore.getState().saveNow(), 0);
              }
            }}
          >
            <ArrowCounterClockwise size={19} />
            <span>
              <b>Reset from factory template</b>Explicitly replace only this saved Demo Room
            </span>
          </button>
        )}
        <button
          onClick={() => {
            duplicateRoom();
            setDialog(null);
          }}
        >
          <Archive size={19} />
          <span>
            <b>Duplicate room</b>Copy {room.name} into this project
          </span>
        </button>
        <button
          onClick={() => {
            void useEditorStore.getState().loadVersions();
            setDialog("versions");
          }}
        >
          <ArrowCounterClockwise size={19} />
          <span>
            <b>Version history</b>Restore a named room version
          </span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (
            browserSave &&
            !window.confirm(
              "Replace this browser's active project with the selected JSON file? Export the current project first if you need to keep it.",
            )
          ) {
            event.target.value = "";
            return;
          }
          try {
            const imported = await importProject(JSON.parse(await file.text()));
            replaceProject(imported);
            setDialog(null);
            pushToast(`${imported.name} imported.`, "success");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Project import failed.", "error");
          }
        }}
      />
      <div className="modal-footer split">
        <button onClick={() => void saveNow()}>
          <FloppyDisk size={16} />
          Save now
        </button>
        <button
          className="danger"
          onClick={async () => {
            if (
              !window.confirm(`Delete “${project.name}” from this computer? This cannot be undone.`)
            )
              return;
            try {
              await deleteLocalProject(project.id);
              const replacement = createBlankProject();
              replaceProject(replacement);
              await useEditorStore.getState().saveNow();
              setDialog(null);
              pushToast("Project deleted; a new blank project is ready.", "success");
            } catch (error) {
              pushToast(
                error instanceof Error ? error.message : "Project could not be deleted.",
                "error",
              );
            }
          }}
        >
          <Trash size={16} />
          Delete project
        </button>
      </div>
    </Modal>
  );
}

function DemoManagerDialog() {
  const project = useEditorStore((state) => state.project);
  const activeRoom = useEditorStore(selectActiveRoom);
  const switchRoom = useEditorStore((state) => state.switchRoom);
  const setDialog = useEditorStore((state) => state.setDialog);
  const createDemo = useEditorStore((state) => state.createDemoFromTemplate);
  const duplicateAsDemo = useEditorStore((state) => state.duplicateRoomAsDemo);
  const setFeatured = useEditorStore((state) => state.setFeaturedDemoRoom);
  const saveAsDemo = useEditorStore((state) => state.saveAsDemoRoom);
  const deleteRoom = useEditorStore((state) => state.deleteRoom);
  const demos = project.rooms
    .filter((room) => room.roomKind === "demo")
    .sort((left, right) =>
      (right.demoSavedAt ?? right.updatedAt).localeCompare(left.demoSavedAt ?? left.updatedAt),
    );

  const openRoom = (roomId: string) => {
    switchRoom(roomId);
    setDialog(null);
    window.location.assign("/");
  };

  return (
    <Modal title="Demo Manager" eyebrow="Reusable presentation rooms" wide>
      <div className="demo-manager-intro">
        <Database size={24} weight="duotone" />
        <span>
          <b>Demos are independent editable rooms</b>
          Save or duplicate a room without overwriting DEMO-01. The featured demo is the room opened
          by the header action.
        </span>
      </div>
      <div className="demo-manager-actions">
        <button className="primary-action" onClick={() => void saveAsDemo()}>
          <FloppyDisk size={16} />
          {activeRoom.roomKind === "demo" ? "Update current demo" : "Save current room as demo"}
        </button>
        <button onClick={() => duplicateAsDemo(activeRoom.id)}>
          <Copy size={16} /> Duplicate current as new demo
        </button>
        <button onClick={() => createDemo()}>
          <FilePlus size={16} /> Create from factory template
        </button>
      </div>
      <div className="demo-manager-list">
        {demos.map((room) => {
          const featured = room.id === project.featuredDemoRoomId;
          return (
            <article key={room.id} className={featured ? "featured" : ""}>
              <span className="demo-manager-mark">
                <Database size={20} weight="duotone" />
              </span>
              <span className="demo-manager-copy">
                <span>
                  <b>{room.name}</b>
                  {featured && (
                    <em>
                      <Star size={12} weight="fill" /> Featured
                    </em>
                  )}
                </span>
                <small>
                  {room.code} ·{" "}
                  {room.scene.objects.filter((object) => object.objectType !== "wall").length}{" "}
                  assets · {room.scene.inventoryItems.length} inventory
                </small>
                <code>{room.id}</code>
              </span>
              <span className="demo-manager-row-actions">
                {!featured && (
                  <button onClick={() => setFeatured(room.id)}>
                    <Star size={15} /> Set featured
                  </button>
                )}
                <button onClick={() => openRoom(room.id)}>
                  Open <ArrowRight size={15} />
                </button>
                <button
                  className="danger-icon"
                  aria-label={`Delete ${room.name}`}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete demo “${room.name}”? Other rooms and the factory template will remain unchanged.`,
                      )
                    )
                      return;
                    deleteRoom(room.id);
                  }}
                >
                  <Trash size={15} />
                </button>
              </span>
            </article>
          );
        })}
        {!demos.length && (
          <div className="empty-state">
            <Database size={32} />
            <b>No editable demos yet</b>
            <span>Save the current room or create an independent template copy.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function VersionDialog() {
  const room = useEditorStore(selectActiveRoom);
  const saveVersion = useEditorStore((state) => state.saveVersion);
  const saveAsDemoRoom = useEditorStore((state) => state.saveAsDemoRoom);
  const [name, setName] = useState(`${room.name} — ${new Date().toLocaleDateString("en-CA")}`);
  const [note, setNote] = useState("");
  return (
    <Modal title="Save a named room version" eyebrow="Local versioning">
      <div className="dialog-callout">
        <FloppyDisk size={22} />
        <span>
          <b>Capture {room.name} as it is now</b>The version stores the validated scene and indexing
          hierarchy independently from autosave.
        </span>
      </div>
      <label className="dialog-field">
        <span>Version name</span>
        <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="dialog-field">
        <span>Change note</span>
        <textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What changed in this version?"
        />
      </label>
      <div className="modal-footer">
        <button onClick={() => void saveAsDemoRoom()}>
          <Database size={16} />
          {room.roomKind === "demo" ? "Update saved Demo Room" : "Save as Demo Room"}
        </button>
        <button
          className="primary-action"
          disabled={!name.trim()}
          onClick={() => void saveVersion(name, note)}
        >
          <Check size={16} />
          Save version
        </button>
      </div>
    </Modal>
  );
}

function VersionsDialog() {
  const versions = useEditorStore((state) => state.versions);
  const restoreVersion = useEditorStore((state) => state.restoreVersion);
  const duplicateVersionToRoom = useEditorStore((state) => state.duplicateVersionToRoom);
  const loadVersions = useEditorStore((state) => state.loadVersions);
  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);
  return (
    <Modal title="Room version history" eyebrow="Restore points" wide>
      <div className="version-list">
        {versions.map((version: RoomVersion) => (
          <article key={version.id}>
            <div className="version-mark">
              <FloppyDisk size={19} />
            </div>
            <div>
              <b>{version.name}</b>
              <span>
                {new Date(version.createdAt).toLocaleString()} · schema v{version.schemaVersion}
              </span>
              <p>{version.note || "No change note."}</p>
            </div>
            <div className="version-actions">
              <button onClick={() => void restoreVersion(version.id)}>
                <ArrowCounterClockwise size={15} />
                Restore
              </button>
              <button onClick={() => void duplicateVersionToRoom(version.id)}>
                <Copy size={15} />
                Duplicate as room
              </button>
            </div>
          </article>
        ))}
        {!versions.length && (
          <div className="empty-state">
            <FloppyDisk size={32} />
            <b>No named versions yet</b>
            <span>Use “Save room version” to create the first restore point.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SettingsDialog() {
  const room = useEditorStore(selectActiveRoom);
  const grid = useEditorStore((state) => state.gridSize);
  const tolerance = useEditorStore((state) => state.snapTolerance);
  const setGrid = useEditorStore((state) => state.setGridSize);
  const setTolerance = useEditorStore((state) => state.setSnapTolerance);
  const floor = useEditorStore((state) => state.floorVisible);
  const walls = useEditorStore((state) => state.wallTransparent);
  const toggleFloor = useEditorStore((state) => state.toggleFloor);
  const toggleWalls = useEditorStore((state) => state.toggleWalls);
  return (
    <Modal title="Editor settings" eyebrow="Precision & performance">
      <div className="settings-list">
        <section>
          <div className="settings-icon">
            <GridFour size={20} />
          </div>
          <div>
            <b>Grid interval</b>
            <span>Canonical drawing interval in millimetres.</span>
          </div>
          <select value={grid} onChange={(event) => setGrid(Number(event.target.value))}>
            <option value="100">100 mm</option>
            <option value="200">200 mm</option>
            <option value="250">250 mm</option>
            <option value="500">500 mm</option>
          </select>
        </section>
        <section>
          <div className="settings-icon">
            <Ruler size={20} />
          </div>
          <div>
            <b>Snap tolerance</b>
            <span>Distance at which edges, centres, corners, and walls attract.</span>
          </div>
          <input
            type="number"
            min="10"
            max="300"
            value={tolerance}
            onChange={(event) => setTolerance(Number(event.target.value))}
          />
        </section>
        <section>
          <div className="settings-icon">
            <Database size={20} />
          </div>
          <div>
            <b>Canonical units</b>
            <span>All stored positions and dimensions use millimetres.</span>
          </div>
          <strong>mm</strong>
        </section>
        <section>
          <div className="settings-icon">
            <GearSix size={20} />
          </div>
          <div>
            <b>3D presentation</b>
            <span>Control floor visibility and wall transparency.</span>
          </div>
          <div className="settings-buttons">
            <button className={floor ? "active" : ""} onClick={toggleFloor}>
              Floor
            </button>
            <button className={walls ? "active" : ""} onClick={toggleWalls}>
              Transparent walls
            </button>
          </div>
        </section>
        <section>
          <div className="settings-icon">
            <Database size={20} />
          </div>
          <div>
            <b>Performance diagnostics</b>
            <span>
              {room.scene.objects.length} scene objects · {room.scene.storageLocations.length}{" "}
              indexed locations · DPR {window.devicePixelRatio.toFixed(1)} ·{" "}
              {navigator.hardwareConcurrency ?? "?"} logical processors
            </span>
          </div>
          <div className="settings-buttons">
            <strong>{room.scene.objects.length < 200 ? "Nominal" : "Review"}</strong>
            <button onClick={() => window.open("/asset-preview", "_blank", "noopener,noreferrer")}>
              Asset preview
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function HelpDialog() {
  const shortcuts = [
    ["V", "Select and marquee"],
    ["H", "Pan tool"],
    ["Wall toolbar", "Draw continuous walls"],
    ["D", "Place a door"],
    ["O", "Place a window"],
    ["M", "Measure distance"],
    ["Space + drag", "Temporary pan"],
    ["Middle-mouse drag", "Pan while Select is active"],
    ["Arrow keys / WASD", "Move the plan viewport in Select mode"],
    ["Mouse wheel", "Zoom around pointer"],
    ["Shift + click", "Multi-select"],
    ["Ctrl/Cmd + Z", "Undo"],
    ["Ctrl/Cmd + Y", "Redo"],
    ["Ctrl/Cmd + C / V", "Copy and paste"],
    ["Shift + D", "Duplicate (Ctrl/Cmd + D also supported)"],
    ["Delete", "Remove selection"],
    ["Escape", "Cancel current tool"],
  ];
  return (
    <Modal title="Working in the room editor" eyebrow="Help & keyboard shortcuts" wide>
      <div className="help-intro">
        <Question size={26} weight="duotone" />
        <span>
          <b>Design the lab. Index every location.</b>Place assets in 2D, verify them in 3D, then
          configure the exact cabinet, shelf, drawer, or bin in the Index Navigator.
        </span>
      </div>
      <div className="shortcut-grid">
        {shortcuts.map(([key, action]) => (
          <div key={key}>
            <kbd>{key}</kbd>
            <span>{action}</span>
          </div>
        ))}
      </div>
      <div className="dialog-callout subtle">
        <Keyboard size={21} />
        <span>
          <b>Tip</b>Double-click an asset card to place it in the room centre, or drag it to an
          exact starting point.
        </span>
      </div>
    </Modal>
  );
}

function ReportsDialog() {
  const room = useEditorStore(selectActiveRoom);
  const pushToast = useEditorStore((state) => state.pushToast);
  const report = (name: string, data: string) => {
    downloadText(`${room.code.toLowerCase()}-${name}.csv`, data, "text/csv;charset=utf-8");
    pushToast(`${name.replaceAll("-", " ")} CSV exported.`, "success");
  };
  return (
    <Modal
      title="Labels & indexing reports"
      eyebrow="Portable local exports"
      wide
      printClass="print-report-modal"
    >
      <div className="report-grid">
        <button onClick={() => report("equipment-list", equipmentCsv(room))}>
          <FileCsv size={24} />
          <span>
            <b>Room equipment list</b>IDs, serials, service dates, and coordinates
          </span>
        </button>
        <button onClick={() => report("location-register", locationsCsv(room))}>
          <FileCsv size={24} />
          <span>
            <b>Storage-location register</b>Every cabinet, shelf, drawer, compartment, and bin
          </span>
        </button>
        <button onClick={() => report("inventory", inventoryCsv(room.scene))}>
          <FileCsv size={24} />
          <span>
            <b>Cabinet contents</b>Inventory with exact location codes
          </span>
        </button>
        <button onClick={() => report("unassigned-inventory", inventoryCsv(room.scene, true))}>
          <FileCsv size={24} />
          <span>
            <b>Unassigned inventory</b>Items that still need a physical location
          </span>
        </button>
        <button onClick={() => report("index-hierarchy", hierarchyCsv(room))}>
          <TreeStructure size={24} />
          <span>
            <b>Full indexing hierarchy</b>Parent-child paths and contents
          </span>
        </button>
        <button onClick={() => window.print()}>
          <Printer size={24} />
          <span>
            <b>Print room register</b>Open the clean A4 browser print view
          </span>
        </button>
      </div>
      <article className="printable-room-register">
        <header>
          <img src="/labspace-mark.svg" alt="" />
          <div>
            <h1>{room.name} indexing register</h1>
            <p>
              {room.code} · Generated {new Date().toLocaleString()}
            </p>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Index code</th>
              <th>Location</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {room.scene.storageLocations.map((location) => (
              <tr key={location.id}>
                <td>{location.indexCode}</td>
                <td>{location.name}</td>
                <td>{location.type}</td>
                <td>
                  {room.scene.inventoryItems.some((item) => item.storageLocationId === location.id)
                    ? "Occupied"
                    : "Empty"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </Modal>
  );
}

function LabelCard({
  location,
  compact = false,
}: {
  location: StorageLocation;
  compact?: boolean;
}) {
  const room = useEditorStore(selectActiveRoom);
  const [qr, setQr] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(
      JSON.stringify({ type: "labspace-location", id: location.id, indexCode: location.indexCode }),
      { width: 180, margin: 1, color: { dark: "#121a1d", light: "#ffffff" } },
    ).then(setQr);
  }, [location.id, location.indexCode]);
  const parent = room.scene.storageLocations.find((entry) => entry.id === location.parentId);
  return (
    <article className={`location-label ${compact ? "compact" : ""}`}>
      <div className="label-brand">
        <img src="/labspace-mark.svg" alt="" />
        <span>LabSpace Atlas</span>
      </div>
      <div className="label-body">
        <div>
          <strong>{location.indexCode}</strong>
          <b>{location.name}</b>
          <span>
            {room.name}
            {parent ? ` · ${parent.name}` : ""}
          </span>
        </div>
        {qr && <img src={qr} alt={`QR code for ${location.indexCode}`} />}
      </div>
    </article>
  );
}

function LabelsDialog() {
  const room = useEditorStore(selectActiveRoom);
  const selectedId = useEditorStore((state) => state.selectedLocationId);
  const [scope, setScope] = useState<"single" | "unit" | "room">(selectedId ? "single" : "room");
  const selected = room.scene.storageLocations.find((entry) => entry.id === selectedId);
  const locations =
    scope === "single" && selected
      ? [selected]
      : scope === "unit" && selected
        ? room.scene.storageLocations.filter((entry) => entry.objectId === selected.objectId)
        : room.scene.storageLocations;
  return (
    <Modal
      title="Location label preview"
      eyebrow="A4 print layout"
      wide
      printClass="print-label-modal"
    >
      <div className="label-toolbar">
        <div className="filter-chips">
          <button
            className={scope === "single" ? "active" : ""}
            disabled={!selected}
            onClick={() => setScope("single")}
          >
            Single label
          </button>
          <button
            className={scope === "unit" ? "active" : ""}
            disabled={!selected}
            onClick={() => setScope("unit")}
          >
            Selected storage unit
          </button>
          <button className={scope === "room" ? "active" : ""} onClick={() => setScope("room")}>
            Whole room
          </button>
        </div>
        <button className="primary-action" onClick={() => window.print()}>
          <Printer size={16} />
          Print {locations.length} label{locations.length === 1 ? "" : "s"}
        </button>
      </div>
      <div className="label-sheet">
        {locations.map((location) => (
          <LabelCard key={location.id} location={location} compact={locations.length > 1} />
        ))}
      </div>
    </Modal>
  );
}

function ReindexDialog() {
  const project = useEditorStore((state) => state.project);
  const room = useEditorStore(selectActiveRoom);
  const apply = useEditorStore((state) => state.applyReindex);
  const laboratoryCode =
    project.laboratories.find((laboratory) => laboratory.id === room.laboratoryId)?.code ??
    project.laboratories[0]?.code ??
    "LAB";
  const changes = useMemo(() => previewReindex(room, laboratoryCode), [laboratoryCode, room]);
  return (
    <Modal title="Preview controlled reindex" eyebrow="Stable codes unless you confirm" wide>
      <div className="dialog-callout">
        <TreeStructure size={23} />
        <span>
          <b>{changes.length} code changes proposed</b>Objects are ordered by zone and physical
          position. Moving an object alone never changes its code.
        </span>
      </div>
      <div className="reindex-table">
        <div className="reindex-head">
          <span>Kind</span>
          <span>Current code</span>
          <span>Proposed code</span>
        </div>
        {changes.map((change) => (
          <div key={`${change.type}-${change.id}`}>
            <em>{change.type}</em>
            <code>{change.before}</code>
            <code>{change.after}</code>
          </div>
        ))}
        {!changes.length && (
          <div className="empty-state compact">
            <Check size={22} />
            <b>Codes already follow the current order</b>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button
          className="primary-action"
          disabled={!changes.length}
          onClick={() => apply(changes)}
        >
          <TreeStructure size={16} />
          Apply {changes.length} changes
        </button>
      </div>
    </Modal>
  );
}

function InventoryDialog() {
  const room = useEditorStore(selectActiveRoom);
  const update = useEditorStore((state) => state.updateInventoryItem);
  const add = useEditorStore((state) => state.addInventoryItem);
  return (
    <Modal title="Inventory assignments" eyebrow="Exact physical locations" wide>
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">{room.name}</span>
          <h3>{room.scene.inventoryItems.length} inventory items</h3>
        </div>
        <button className="small-primary" onClick={() => add(null)}>
          <Package size={15} />
          Add unassigned item
        </button>
      </div>
      <div className="inventory-table">
        <div className="inventory-head">
          <span>Item</span>
          <span>Quantity</span>
          <span>Owner</span>
          <span>Exact location</span>
          <span>Expiry</span>
        </div>
        {room.scene.inventoryItems.map((item) => (
          <div className="inventory-row" key={item.id}>
            <div className="inventory-item-cell">
              {item.imageSrc ? (
                <img src={item.imageSrc} alt="" className="inventory-item-photo" />
              ) : (
                <span className="inventory-item-photo inventory-item-photo-empty">
                  <Package size={20} weight="duotone" />
                </span>
              )}
              <span className="inventory-item-fields">
                <input
                  aria-label={`Item name for ${item.name}`}
                  value={item.name}
                  onChange={(event) => update(item.id, { name: event.target.value })}
                />
                <input
                  type="url"
                  aria-label={`Record photo URL for ${item.name}`}
                  value={item.imageSrc ?? ""}
                  onChange={(event) =>
                    update(item.id, { imageSrc: event.target.value || undefined })
                  }
                  placeholder="Record photo URL"
                />
              </span>
            </div>
            <div className="quantity-input">
              <input
                type="number"
                value={item.quantity}
                onChange={(event) => update(item.id, { quantity: Number(event.target.value) })}
              />
              <input
                value={item.unit}
                onChange={(event) => update(item.id, { unit: event.target.value })}
              />
            </div>
            <input
              value={item.owner}
              onChange={(event) => update(item.id, { owner: event.target.value })}
              placeholder="Owner"
            />
            <select
              value={item.storageLocationId ?? ""}
              onChange={(event) =>
                update(item.id, { storageLocationId: event.target.value || null })
              }
            >
              <option value="">Unassigned</option>
              {room.scene.storageLocations
                .filter((location) => location.type !== "cabinet")
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.indexCode} · {location.name}
                  </option>
                ))}
            </select>
            <input
              type="date"
              value={item.expiryDate ?? ""}
              onChange={(event) => update(item.id, { expiryDate: event.target.value || null })}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useEditorStore((state) => state.dialog);
  if (!dialog) return null;
  if (dialog === "project") return <ProjectDialog />;
  if (dialog === "version") return <VersionDialog />;
  if (dialog === "versions") return <VersionsDialog />;
  if (dialog === "settings") return <SettingsDialog />;
  if (dialog === "help") return <HelpDialog />;
  if (dialog === "reports") return <ReportsDialog />;
  if (dialog === "labels") return <LabelsDialog />;
  if (dialog === "reindex") return <ReindexDialog />;
  if (dialog === "inventory") return <InventoryDialog />;
  if (dialog === "demos") return <DemoManagerDialog />;
  return null;
}

export function Toasts() {
  const toasts = useEditorStore((state) => state.toasts);
  const remove = useEditorStore((state) => state.removeToast);
  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => remove(toasts[0].id), 3600);
    return () => window.clearTimeout(timer);
  }, [remove, toasts]);
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} className={toast.tone} onClick={() => remove(toast.id)}>
          <span>
            {toast.tone === "success" ? (
              <Check size={16} />
            ) : toast.tone === "error" ? (
              <X size={16} />
            ) : (
              <Question size={16} />
            )}
          </span>
          {toast.message}
        </button>
      ))}
    </div>
  );
}
