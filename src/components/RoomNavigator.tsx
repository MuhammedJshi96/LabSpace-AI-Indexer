import { Buildings, CaretDown, DoorOpen, GridFour, PresentationChart } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";

export function RoomNavigator() {
  const navigatorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const project = useEditorStore((state) => state.project);
  const room = useEditorStore(selectActiveRoom);
  const switchRoom = useEditorStore((state) => state.switchRoom);
  const setDialog = useEditorStore((state) => state.setDialog);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!navigatorRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const chooseRoom = (roomId: string) => {
    switchRoom(roomId);
    setOpen(false);
    if (window.location.pathname === "/facility") window.location.assign("/");
  };

  return (
    <div className={`room-navigator${open ? " is-open" : ""}`} ref={navigatorRef}>
      <button
        type="button"
        className="room-identity"
        title="Switch laboratory room"
        aria-label={`Switch room. Current room: ${room.name}, ${room.code}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="room-navigator-popover"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <b>{room.name}</b>
          <small>{room.code}</small>
        </span>
        <CaretDown className="room-navigator-caret" size={13} />
      </button>
      {open && (
        <div
          id="room-navigator-popover"
          className="room-navigator-popover"
          role="dialog"
          aria-label="Switch laboratory room"
        >
          <div className="room-navigator-head">
            <span>
              <small>Project workspace</small>
              <b>{project.name}</b>
            </span>
            <a href="/facility">
              <GridFour size={16} /> Facility overview
            </a>
          </div>
          <div className="room-navigator-table" role="list" aria-label="Laboratories and rooms">
            {project.laboratories.map((laboratory) => {
              const rooms = project.rooms.filter(
                (entry) =>
                  entry.laboratoryId === laboratory.id && entry.roomKind !== "demo-template",
              );
              return (
                <section key={laboratory.id}>
                  <header>
                    <Buildings size={15} />
                    <span>
                      <b>{laboratory.name}</b>
                      <small>
                        {laboratory.code} · {rooms.length} rooms
                      </small>
                    </span>
                  </header>
                  {rooms.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      className={entry.id === room.id ? "active" : ""}
                      onClick={() => chooseRoom(entry.id)}
                      aria-current={entry.id === room.id ? "page" : undefined}
                    >
                      {entry.roomKind === "demo" ? (
                        <PresentationChart size={16} weight="duotone" />
                      ) : (
                        <DoorOpen size={16} weight="duotone" />
                      )}
                      <span>
                        <b>{entry.name}</b>
                        <small>
                          {entry.code} ·{" "}
                          {
                            entry.scene.objects.filter((object) => object.objectType !== "wall")
                              .length
                          }{" "}
                          assets · {entry.scene.inventoryItems.length} items
                        </small>
                      </span>
                      {project.featuredDemoRoomId === entry.id && <em>Featured</em>}
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
          <button
            type="button"
            className="room-navigator-manage"
            onClick={() => {
              setOpen(false);
              setDialog("project");
            }}
          >
            Manage laboratories and rooms
          </button>
        </div>
      )}
    </div>
  );
}
