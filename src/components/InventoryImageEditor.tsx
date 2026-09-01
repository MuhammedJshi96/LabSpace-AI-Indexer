import { ImageSquare, LinkSimple, Trash, UploadSimple } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";
import {
  INVENTORY_IMAGE_ACCEPT,
  inventoryImageSourceError,
  prepareInventoryImageFile,
} from "../domain/inventory-image";

export function InventoryImageEditor({
  source,
  itemName,
  onChange,
}: {
  source?: string;
  itemName: string;
  onChange: (source: string | undefined) => void;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const isEmbedded = Boolean(source?.startsWith("data:image/"));
  const [draft, setDraft] = useState(isEmbedded ? "" : (source ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyLink = () => {
    const value = draft.trim();
    const message = inventoryImageSourceError(value);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    onChange(value || undefined);
  };

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareInventoryImageFile(file);
      onChange(prepared);
      setDraft("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The image could not be prepared.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <section className="inventory-image-editor wide" aria-label="Inventory item picture">
      <header>
        <span>
          <ImageSquare size={18} weight="duotone" />
        </span>
        <div>
          <b>Item picture</b>
          <small>Use an online image or keep a local photo with this project.</small>
        </div>
        {source && (
          <button
            type="button"
            className="inventory-image-remove"
            onClick={() => {
              setDraft("");
              setError(null);
              onChange(undefined);
            }}
            aria-label={`Remove picture for ${itemName}`}
            title="Remove custom picture"
          >
            <Trash size={15} />
          </button>
        )}
      </header>
      <div className="inventory-image-editor-body">
        <div className={`inventory-image-preview ${source ? "has-image" : ""}`}>
          {source ? (
            <img
              src={source}
              alt={`${itemName} inventory reference`}
              referrerPolicy="no-referrer"
              onError={() =>
                setError("That image could not be loaded. Check the link or choose a file.")
              }
            />
          ) : (
            <span>
              <ImageSquare size={27} weight="duotone" />
              No custom image
            </span>
          )}
          {isEmbedded && <em>Saved with project</em>}
        </div>
        <div className="inventory-image-sources">
          <label htmlFor={inputId} className={`inventory-file-button ${busy ? "is-busy" : ""}`}>
            <UploadSimple size={16} />
            {busy ? "Preparing image…" : "Browse computer"}
          </label>
          <input
            ref={fileInput}
            id={inputId}
            className="inventory-file-input"
            type="file"
            accept={INVENTORY_IMAGE_ACCEPT}
            disabled={busy}
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          <div className="inventory-link-entry">
            <LinkSimple size={16} />
            <input
              type="url"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                applyLink();
              }}
              placeholder={isEmbedded ? "Replace with an online image URL" : "https://…"}
              aria-label="Online inventory image URL"
            />
            <button type="button" onClick={applyLink} disabled={!draft.trim()}>
              Use link
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <p className="inventory-image-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="inventory-image-note">
          Local images are resized for performance and embedded in the saved inventory record.
        </p>
      )}
    </section>
  );
}
