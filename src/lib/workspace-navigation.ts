/** In-document navigation keeps the editor store, selection and camera alive. */
export function navigateWorkspace(url: string) {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function openStorageWorkspace(
  roomId: string,
  objectId?: string | null,
  locationId?: string | null,
) {
  const params = new URLSearchParams({ view: "storage", room: roomId });
  if (objectId) params.set("object", objectId);
  if (locationId) params.set("location", locationId);
  navigateWorkspace(`/inventory?${params}`);
}
