import { Check, PencilSimple, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../store/editor-store";

export function StorageNameEditor({
  roomId,
  locationId,
  showLabel = false,
  displayName,
}: {
  roomId: string;
  locationId: string;
  showLabel?: boolean;
  displayName?: string;
}) {
  const location = useEditorStore((state) =>
    state.project.rooms
      .find((room) => room.id === roomId)
      ?.scene.storageLocations.find((entry) => entry.id === locationId),
  );
  const rename = useEditorStore((state) => state.renameStorageLocation);
  const pending = useEditorStore((state) => Boolean(state.pendingAgentChange));
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    } else if (wasEditing.current) trigger.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  if (!location) return null;
  if (!editing)
    return (
      <div className="storage-inline-name">
        <b title={location.name}>{displayName ?? location.name}</b>
        <button
          ref={trigger}
          type="button"
          aria-label={`Rename ${location.type}`}
          title={`Rename ${location.name}`}
          disabled={pending}
          onClick={() => {
            setName(location.name);
            setError("");
            setEditing(true);
          }}
        >
          <PencilSimple size={17} />
          {showLabel && <span>Rename</span>}
        </button>
      </div>
    );
  return (
    <form
      className="storage-inline-form"
      aria-label={`Rename ${location.type}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setEditing(false);
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setError("Enter a name before saving.");
          return;
        }
        if (rename(roomId, locationId, name)) setEditing(false);
        else setError("Name not saved. Check the location or pending agent review.");
      }}
    >
      <label>
        <span>Storage name</span>
        <input
          ref={input}
          value={name}
          maxLength={100}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
        />
      </label>
      <div className="storage-inline-actions">
        <button type="submit" disabled={pending}>
          <Check size={15} />
          Save name
        </button>
        <button type="button" onClick={() => setEditing(false)}>
          <X size={15} />
          Cancel
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
