import { describe, expect, it } from "vitest";
import { inventoryImageSourceError } from "../../src/domain/inventory-image";

describe("inventory image sources", () => {
  it("accepts online links and project-local image paths", () => {
    expect(inventoryImageSourceError("https://images.example.org/item.webp")).toBeNull();
    expect(inventoryImageSourceError("http://localhost:3004/item.png")).toBeNull();
    expect(inventoryImageSourceError("/images/inventory/item.png")).toBeNull();
  });

  it("rejects incomplete links and unsafe protocols", () => {
    expect(inventoryImageSourceError("example.com/item.png")).toMatch(/complete image link/i);
    expect(inventoryImageSourceError("javascript:alert(1)")).toMatch(/http/i);
    expect(inventoryImageSourceError("//example.com/item.png")).toMatch(/complete image link/i);
  });
});
