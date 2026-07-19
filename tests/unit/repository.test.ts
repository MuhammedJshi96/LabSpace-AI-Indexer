import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteProjectRepository } from "../../server/repository";

const databasePath = resolve("data", "test-labspace.sqlite");

afterEach(() => {
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
});

describe("SQLite project repository", () => {
  it("seeds the blank starter, saves, reopens, and versions its active room", () => {
    const repository = new SqliteProjectRepository(databasePath);
    const project = repository.getActiveProject();
    expect(project.rooms[0].name).toBe("Room 809 demo template");
    expect(project.rooms[0].roomKind).toBe("demo-template");
    project.name = "Repository test project";
    repository.saveProject(project);
    const activeRoom = project.rooms.find((room) => room.id === project.activeRoomId)!;
    expect(activeRoom.name).toBe("Empty lab plan");
    const version = repository.saveVersion(
      project.id,
      project.activeRoomId,
      "Test version",
      "Automated",
      activeRoom.scene,
    );
    expect(repository.listVersions(project.id, project.activeRoomId)[0].id).toBe(version.id);
    repository.close();

    const reopened = new SqliteProjectRepository(databasePath);
    expect(reopened.getActiveProject().name).toBe("Repository test project");
    expect(reopened.getVersion(version.id)?.name).toBe("Test version");
    reopened.close();
  });

  it("resets every development project to one deterministic seed", () => {
    const repository = new SqliteProjectRepository(databasePath);
    const seed = repository.getActiveProject();
    repository.saveProject({
      ...seed,
      id: "project-alternate-test",
      name: "Alternate test project",
      laboratories: seed.laboratories.map((laboratory) => ({
        ...laboratory,
        projectId: "project-alternate-test",
      })),
    });
    expect(repository.getActiveProject().name).toBe("Alternate test project");

    const reset = repository.resetToSeed();
    expect(reset.id).toBe("project-labspace-demo");
    expect(reset.rooms[0].scene.storageLocations).toHaveLength(15);
    expect(reset.rooms[0].scene.inventoryItems).toHaveLength(7);
    repository.close();

    const reopened = new SqliteProjectRepository(databasePath);
    expect(reopened.getActiveProject().id).toBe("project-labspace-demo");
    reopened.close();
  });
});
