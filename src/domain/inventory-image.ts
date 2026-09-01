export const INVENTORY_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export const INVENTORY_IMAGE_MAX_FILE_BYTES = 12 * 1024 * 1024;
// Keep many embedded inventory thumbnails comfortably below the project's
// existing 12 MB save-request boundary.
export const INVENTORY_IMAGE_MAX_DATA_URL_LENGTH = 360_000;

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function inventoryImageSourceError(source: string) {
  const value = source.trim();
  if (!value) return null;
  if (/^\/(?!\/)/.test(value)) return null;
  if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? null
      : "Use an http(s) image link or a project image path.";
  } catch {
    return "Enter a complete image link, for example https://example.com/photo.jpg.";
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file could not be read as an image."));
    };
    image.src = objectUrl;
  });
}

/**
 * Creates a bounded, project-portable image source for an inventory record.
 * The result is deliberately embedded in the saved project so a browser reload
 * never depends on the original path on the user's computer.
 */
export async function prepareInventoryImageFile(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  }
  if (file.size > INVENTORY_IMAGE_MAX_FILE_BYTES) {
    throw new Error("Choose an image smaller than 12 MB.");
  }

  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("The selected image has no readable dimensions.");
  }

  const attempts = [
    { edge: 960, quality: 0.86 },
    { edge: 760, quality: 0.82 },
    { edge: 600, quality: 0.78 },
    { edge: 480, quality: 0.72 },
  ];
  for (const attempt of attempts) {
    const scale = Math.min(1, attempt.edge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("This browser cannot prepare the selected image.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/webp", attempt.quality);
    if (dataUrl.length <= INVENTORY_IMAGE_MAX_DATA_URL_LENGTH) return dataUrl;
  }

  throw new Error("The image is too detailed to store safely. Try a smaller crop.");
}
