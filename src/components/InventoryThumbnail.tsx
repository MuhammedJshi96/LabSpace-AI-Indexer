import { Package } from "@phosphor-icons/react";
import { useState } from "react";
import type { InventoryItem } from "../domain/schema";
import { inferInventoryRecordImage } from "../domain/digital-twin-index";

export function InventoryThumbnail({ item }: { item: InventoryItem }) {
  const source = item.imageSrc || inferInventoryRecordImage(item);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className="inventory-item-photo"
      title={item.imageSrc ? "Record image" : source ? "Catalog reference image" : "No item image"}
    >
      {source && source !== failed ? (
        <img src={source} alt="" loading="lazy" onError={() => setFailed(source)} />
      ) : (
        <Package size={23} weight="duotone" />
      )}
    </span>
  );
}
