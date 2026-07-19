import {
  ProjectSchema,
  RoomVersionSchema,
  type Project,
  type RoomVersion,
  type Scene,
} from "../domain/schema";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export async function loadProject(): Promise<Project> {
  return ProjectSchema.parse(await request<unknown>(`/api/project?revision=${Date.now()}`));
}

export async function persistProject(project: Project): Promise<Project> {
  return ProjectSchema.parse(
    await request<unknown>(`/api/project/${project.id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),
  );
}

export async function saveRoomVersion(
  projectId: string,
  roomId: string,
  name: string,
  note: string,
  scene: Scene,
): Promise<RoomVersion> {
  return RoomVersionSchema.parse(
    await request<unknown>("/api/versions", {
      method: "POST",
      body: JSON.stringify({ projectId, roomId, name, note, scene }),
    }),
  );
}

export async function listRoomVersions(projectId: string, roomId: string): Promise<RoomVersion[]> {
  const result = await request<unknown[]>(
    `/api/versions?projectId=${encodeURIComponent(projectId)}&roomId=${encodeURIComponent(roomId)}`,
  );
  return result.map((entry) => RoomVersionSchema.parse(entry));
}

export async function getRoomVersion(versionId: string): Promise<RoomVersion> {
  return RoomVersionSchema.parse(await request<unknown>(`/api/versions/${versionId}`));
}

export async function importProject(project: unknown): Promise<Project> {
  return ProjectSchema.parse(
    await request<unknown>("/api/import", { method: "POST", body: JSON.stringify(project) }),
  );
}

export async function deleteLocalProject(projectId: string): Promise<void> {
  const response = await fetch(`/api/project/${projectId}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204)
    throw new Error("The local project could not be deleted.");
}
