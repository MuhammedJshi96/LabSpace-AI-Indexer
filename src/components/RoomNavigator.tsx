import { Buildings, CaretDown, DoorOpen, GridFour, PresentationChart } from "@phosphor-icons/react";
import { useRef } from "react";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";

export function RoomNavigator() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const project = useEditorStore((state) => state.project);
  const room = useEditorStore(selectActiveRoom);
  const switchRoom = useEditorStore((state) => state.switchRoom);
  const setDialog = useEditorStore((state) => state.setDialog);

  const chooseRoom = (roomId: string) => {
    switchRoom(roomId);
    detailsRef.current?.removeAttribute("open");
    if (window.location.pathname === "/facility") window.location.assign("/");
  };

  return (
    <details className="room-navigator" ref={detailsRef}>
      <summary className="room-identity" title="Switch laboratory room">
        <span>
          <b>{room.name}</b>
          <small>{room.code}</small>
        </span>
        <CaretDown size={13} />
      </summary>
      <div className="room-navigator-popover">
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
                    <small>{laboratory.code} · {rooms.length} rooms</small>
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
                        {entry.code} · {entry.scene.objects.filter((object) => object.objectType !== "wall").length} assets · {entry.scene.inventoryItems.length} items
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
            detailsRef.current?.removeAttribute("open");
            setDialog("project");
          }}
        >
          Manage laboratories and rooms
        </button>
      </div>
    </details>
  );
}
