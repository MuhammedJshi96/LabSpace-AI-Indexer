import { ProjectSchema, RoomVersionSchema, type Project, type RoomVersion } from "../domain/schema";

// Deliberately independent of app/build versions: deployments must never create a new save slot.
const DATABASE = "labspace-saved-workspace";
const STORAGE_ERROR =
  "Browser storage could not save your project. Keep this tab open and export your project JSON. Check available disk space and browser site-data permissions, then retry Save.";
const CONFLICT_ERROR =
  "Another tab saved this workspace. Your changes are still in this tab but were not saved over it. Export your project JSON before reloading to open the latest saved copy.";

export type BrowserWorkspace = { format: 1; revision: number; project: Project };

function parseWorkspace(value: unknown): BrowserWorkspace | null {
  if (value === undefined) return null;
  const record = value as Partial<BrowserWorkspace> | null;
  if (
    !record ||
    record.format !== 1 ||
    !Number.isSafeInteger(record.revision) ||
    (record.revision ?? 0) < 1
  )
    throw new Error(
      "The saved browser workspace cannot be read. It has not been replaced. Keep this browser's site data and restore a project JSON backup.",
    );
  const parsed = ProjectSchema.safeParse(record.project);
  if (!parsed.success)
    throw new Error(
      "The saved browser project uses invalid or unsupported data. It has not been replaced. Keep this browser's site data and restore a compatible project JSON backup.",
    );
  return { format: 1, revision: record.revision!, project: parsed.data };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error(STORAGE_ERROR));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("workspace");
      request.result.createObjectStore("versions", { keyPath: "id" });
    };
    request.onerror = () => reject(new Error(STORAGE_ERROR));
    request.onblocked = () =>
      reject(new Error("Close other LabSpace tabs, then retry opening this saved workspace."));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

// A single read/write transaction gives compare-and-swap semantics across tabs.
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction, finish: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(["workspace", "versions"], mode);
    let result: T;
    let failure: Error | undefined;
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(failure ?? new Error(STORAGE_ERROR));
    };
    const fail = (error: Error) => {
      failure =
        typeof DOMException !== "undefined" && error instanceof DOMException
          ? new Error(STORAGE_ERROR)
          : error;
      tx.abort();
    };
    try {
      run(
        tx,
        (value) => {
          result = value;
        },
        fail,
      );
    } catch (error) {
      fail(error instanceof Error ? error : new Error(STORAGE_ERROR));
    }
  });
}

export function readBrowserWorkspace(): Promise<BrowserWorkspace | null> {
  return transaction("readonly", (tx, finish, fail) => {
    const request = tx.objectStore("workspace").get("active");
    request.onsuccess = () => {
      try {
        finish(parseWorkspace(request.result));
      } catch (error) {
        fail(error as Error);
      }
    };
  });
}

export function initializeBrowserWorkspace(project: Project, versions: RoomVersion[]) {
  return transaction<BrowserWorkspace>("readwrite", (tx, finish, fail) => {
    const store = tx.objectStore("workspace");
    const request = store.get("active");
    request.onsuccess = () => {
      try {
        const existing = parseWorkspace(request.result);
        if (existing) return finish(existing); // Another tab won initialization. Never seed over it.
        const record: BrowserWorkspace = {
          format: 1,
          revision: 1,
          project: ProjectSchema.parse(project),
        };
        store.put(record, "active");
        for (const version of versions)
          tx.objectStore("versions").put(RoomVersionSchema.parse(version));
        finish(record);
      } catch (error) {
        fail(error as Error);
      }
    };
  });
}

export function writeBrowserProject(
  project: Project,
  expectedRevision: number,
  deleteProjectId?: string,
) {
  const parsed = ProjectSchema.parse(project);
  return transaction<BrowserWorkspace>("readwrite", (tx, finish, fail) => {
    const store = tx.objectStore("workspace");
    const request = store.get("active");
    request.onsuccess = () => {
      try {
        const previous = parseWorkspace(request.result);
        if (
          !previous ||
          previous.revision !== expectedRevision ||
          (deleteProjectId && previous.project.id !== deleteProjectId)
        )
          return fail(new Error(CONFLICT_ERROR));
        const record: BrowserWorkspace = {
          format: 1,
          revision: previous.revision + 1,
          project: { ...parsed, updatedAt: new Date().toISOString() },
        };
        store.put(record, "active");
        if (deleteProjectId) {
          const versions = tx.objectStore("versions");
          const read = versions.getAll();
          read.onsuccess = () => {
            for (const version of read.result as RoomVersion[]) {
              if (version.projectId === deleteProjectId) versions.delete(version.id);
            }
          };
        }
        finish(record);
      } catch (error) {
        fail(error as Error);
      }
    };
  });
}

export function writeBrowserVersion(version: RoomVersion) {
  const parsed = RoomVersionSchema.parse(version);
  return transaction<RoomVersion>("readwrite", (tx, finish) => {
    tx.objectStore("versions").put(parsed);
    finish(parsed);
  });
}

export function readBrowserVersions(projectId: string, roomId: string) {
  return transaction<RoomVersion[]>("readonly", (tx, finish, fail) => {
    const request = tx.objectStore("versions").getAll();
    request.onsuccess = () => {
      try {
        finish(
          request.result
            .map((value: unknown) => RoomVersionSchema.parse(value))
            .filter((entry) => entry.projectId === projectId && entry.roomId === roomId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      } catch {
        fail(new Error("Saved room versions could not be read; no saved data has been changed."));
      }
    };
  });
}

export function readBrowserVersion(id: string) {
  return transaction<RoomVersion>("readonly", (tx, finish, fail) => {
    const request = tx.objectStore("versions").get(id);
    request.onsuccess = () => {
      const parsed = RoomVersionSchema.safeParse(request.result);
      if (!parsed.success) return fail(new Error("Saved room version not found or unreadable."));
      finish(parsed.data);
    };
  });
}
