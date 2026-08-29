import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSeedProject } from "../src/domain/seed";
import {
  ProjectSchema,
  RoomVersionSchema,
  type Project,
  type RoomVersion,
  type Scene,
} from "../src/domain/schema";

export interface ProjectRepository {
  getActiveProject(): Project;
  saveProject(project: Project): Project;
  listVersions(projectId: string, roomId: string): RoomVersion[];
  saveVersion(
    projectId: string,
    roomId: string,
    name: string,
    note: string,
    scene: Scene,
  ): RoomVersion;
  getVersion(versionId: string): RoomVersion | null;
  deleteProject(projectId: string): void;
  resetToSeed(): Project;
}

export class SqliteProjectRepository implements ProjectRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.migrate();
    this.seed();
  }

  private migrate() {
    const version = Number(this.database.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    if (version < 1) {
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS room_versions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          room_id TEXT NOT NULL,
          name TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          schema_version INTEGER NOT NULL,
          scene_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_room_version_name
          ON room_versions(project_id, room_id, name, created_at);
        PRAGMA user_version = 1;
      `);
    }
  }

  private seed() {
    const row = this.database.prepare("SELECT COUNT(*) AS count FROM projects").get() as {
      count: number;
    };
    if (Number(row.count) === 0) this.saveProject(createSeedProject());
  }

  getActiveProject(): Project {
    const row = this.database
      .prepare("SELECT data_json FROM projects ORDER BY updated_at DESC LIMIT 1")
      .get() as { data_json: string } | undefined;
    if (!row) return this.saveProject(createSeedProject());
    return ProjectSchema.parse(JSON.parse(row.data_json));
  }

  saveProject(input: Project): Project {
    const project = ProjectSchema.parse({ ...input, updatedAt: new Date().toISOString() });
    this.database
      .prepare(
        `INSERT INTO projects (id, name, schema_version, data_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           schema_version = excluded.schema_version,
           data_json = excluded.data_json,
           updated_at = excluded.updated_at`,
      )
      .run(
        project.id,
        project.name,
        project.schemaVersion,
        JSON.stringify(project),
        project.createdAt,
        project.updatedAt,
      );
    return project;
  }

  listVersions(projectId: string, roomId: string): RoomVersion[] {
    const rows = this.database
      .prepare(
        "SELECT * FROM room_versions WHERE project_id = ? AND room_id = ? ORDER BY created_at DESC",
      )
      .all(projectId, roomId) as Array<Record<string, unknown>>;
    return rows.map((row) =>
      RoomVersionSchema.parse({
        id: row.id,
        projectId: row.project_id,
        roomId: row.room_id,
        name: row.name,
        note: row.note,
        schemaVersion: row.schema_version,
        scene: JSON.parse(String(row.scene_json)),
        createdAt: row.created_at,
      }),
    );
  }

  saveVersion(
    projectId: string,
    roomId: string,
    name: string,
    note: string,
    scene: Scene,
  ): RoomVersion {
    const version = RoomVersionSchema.parse({
      id: crypto.randomUUID(),
      projectId,
      roomId,
      name,
      note,
      schemaVersion: scene.schemaVersion,
      scene,
      createdAt: new Date().toISOString(),
    });
    this.database
      .prepare(
        `INSERT INTO room_versions (id, project_id, room_id, name, note, schema_version, scene_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        version.id,
        projectId,
        roomId,
        name,
        note,
        version.schemaVersion,
        JSON.stringify(scene),
        version.createdAt,
      );
    return version;
  }

  getVersion(versionId: string): RoomVersion | null {
    const row = this.database.prepare("SELECT * FROM room_versions WHERE id = ?").get(versionId) as
      Record<string, unknown> | undefined;
    if (!row) return null;
    return RoomVersionSchema.parse({
      id: row.id,
      projectId: row.project_id,
      roomId: row.room_id,
      name: row.name,
      note: row.note,
      schemaVersion: row.schema_version,
      scene: JSON.parse(String(row.scene_json)),
      createdAt: row.created_at,
    });
  }

  deleteProject(projectId: string) {
    this.database.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  }

  resetToSeed() {
    this.database.exec("DELETE FROM projects;");
    return this.saveProject(createSeedProject());
  }

  close() {
    this.database.close();
  }
}

function cloneProject(project: Project) {
  return ProjectSchema.parse(structuredClone(project));
}

function cloneVersion(version: RoomVersion) {
  return RoomVersionSchema.parse(structuredClone(version));
}

/**
 * Browser-session repository used by the public judge deployment. It provides
 * the complete save/version workflow without sharing one visitor's changes
 * with another visitor or writing judge data to the machine-local database.
 */
export class MemoryProjectRepository implements ProjectRepository {
  private project: Project | null = cloneProject(createSeedProject());
  private readonly versions = new Map<string, RoomVersion>();

  getActiveProject(): Project {
    if (!this.project) this.project = cloneProject(createSeedProject());
    return cloneProject(this.project);
  }

  saveProject(input: Project): Project {
    this.project = ProjectSchema.parse({
      ...structuredClone(input),
      updatedAt: new Date().toISOString(),
    });
    return cloneProject(this.project);
  }

  listVersions(projectId: string, roomId: string): RoomVersion[] {
    return [...this.versions.values()]
      .filter((version) => version.projectId === projectId && version.roomId === roomId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneVersion);
  }

  saveVersion(
    projectId: string,
    roomId: string,
    name: string,
    note: string,
    scene: Scene,
  ): RoomVersion {
    const version = RoomVersionSchema.parse({
      id: crypto.randomUUID(),
      projectId,
      roomId,
      name,
      note,
      schemaVersion: scene.schemaVersion,
      scene: structuredClone(scene),
      createdAt: new Date().toISOString(),
    });
    this.versions.set(version.id, version);
    return cloneVersion(version);
  }

  getVersion(versionId: string): RoomVersion | null {
    const version = this.versions.get(versionId);
    return version ? cloneVersion(version) : null;
  }

  deleteProject(projectId: string) {
    if (this.project?.id === projectId) this.project = null;
    for (const [versionId, version] of this.versions) {
      if (version.projectId === projectId) this.versions.delete(versionId);
    }
  }

  resetToSeed(): Project {
    this.project = cloneProject(createSeedProject());
    this.versions.clear();
    return cloneProject(this.project);
  }

  close() {}
}
