import { describe, expect, it } from "vitest";
import {
  ANALYTICAL_CORE_ENVIRONMENT_PROFILE,
  ANALYTICAL_CORE_ENVIRONMENT_PROFILE_ID,
  getLaboratoryEnvironmentProfile,
  hasLaboratoryEnvironmentProfile,
  LABORATORY_ENVIRONMENT_PROFILES,
  ROOM_809_DEMO_ENVIRONMENT_PROFILE,
  ROOM_809_DEMO_ENVIRONMENT_PROFILE_ID,
} from "../../src/domain/laboratory-environment";
import { createBlankRoom } from "../../src/domain/room-factory";
import { createSeedProject } from "../../src/domain/seed";

describe("laboratory environment profiles", () => {
  it("keeps the competition template context-free while retaining optional profiles", () => {
    const template = createSeedProject().rooms[0];

    expect(template.environmentProfileId).toBeNull();
    expect(getLaboratoryEnvironmentProfile(template)).toBeNull();
    expect(
      getLaboratoryEnvironmentProfile({
        environmentProfileId: ROOM_809_DEMO_ENVIRONMENT_PROFILE_ID,
      }),
    ).toBe(ROOM_809_DEMO_ENVIRONMENT_PROFILE);
  });

  it("keeps blank, unassigned, and unknown-profile rooms context-free", () => {
    const template = createSeedProject().rooms[0];
    const blank = createBlankRoom(template, { name: "Blank room", code: "BLANK" });

    expect(blank.environmentProfileId).toBeNull();
    expect(hasLaboratoryEnvironmentProfile(blank)).toBe(false);
    expect(getLaboratoryEnvironmentProfile({ environmentProfileId: null })).toBeNull();
    expect(
      getLaboratoryEnvironmentProfile({ environmentProfileId: "unregistered-profile" }),
    ).toBeNull();
  });

  it("keeps each bundled profile within its assigned room envelope", () => {
    const project = createSeedProject();
    expect(Object.keys(LABORATORY_ENVIRONMENT_PROFILES)).toEqual([
      ROOM_809_DEMO_ENVIRONMENT_PROFILE_ID,
      ANALYTICAL_CORE_ENVIRONMENT_PROFILE_ID,
    ]);
    expect(ROOM_809_DEMO_ENVIRONMENT_PROFILE.lightFixtures).toHaveLength(6);
    expect(ROOM_809_DEMO_ENVIRONMENT_PROFILE.powerDrops).toHaveLength(6);
    expect(ROOM_809_DEMO_ENVIRONMENT_PROFILE.bottles).toHaveLength(17);
    expect(ROOM_809_DEMO_ENVIRONMENT_PROFILE.consumableBoxes).toHaveLength(9);
    expect(ROOM_809_DEMO_ENVIRONMENT_PROFILE.documentBoards).toHaveLength(2);
    expect(ANALYTICAL_CORE_ENVIRONMENT_PROFILE.lightFixtures).toHaveLength(9);

    for (const room of project.rooms) {
      const profile = getLaboratoryEnvironmentProfile(room);
      if (!profile) continue;
      const halfWidth = room.width / 2 / 1000;
      const halfDepth = room.depth / 2 / 1000;
      const points = [
        ...profile.lightFixtures,
        ...profile.vents,
        ...profile.powerDrops,
        ...profile.ceilingRails.map((rail) => rail.position),
        ...profile.servicePosts.map((member) => member.position),
        ...profile.serviceCrossbars.map((member) => member.position),
        ...profile.serviceRails.map((member) => member.position),
        ...profile.ductRuns.map((member) => member.position),
        ...profile.ductCollars.map((member) => member.position),
        ...profile.ductTerminals.map((member) => member.position),
        ...profile.bottles.map((bottle) => bottle.position),
        ...profile.consumableBoxes.map((box) => box.position),
        ...profile.areaLights.map((light) => light.position),
      ];

      for (const [x, y, z] of points) {
        expect(Math.abs(x)).toBeLessThanOrEqual(halfWidth);
        expect(Math.abs(z)).toBeLessThanOrEqual(halfDepth);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(profile.ceilingHeight);
      }
    }
  });
});
