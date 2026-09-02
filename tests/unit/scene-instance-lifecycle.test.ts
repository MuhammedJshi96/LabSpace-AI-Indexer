import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { attachExclusiveScene } from "../../src/lib/scene-instance-lifecycle";

describe("asset scene instance lifecycle", () => {
  it("keeps only the newest scene when an asset changes before stale cleanup", () => {
    const host = new THREE.Group();
    const printerA = new THREE.Group();
    printerA.name = "compact-printer-a";
    const printerB = new THREE.Group();
    printerB.name = "compact-printer-b";

    const releaseA = attachExclusiveScene(host, printerA);
    const releaseB = attachExclusiveScene(host, printerB);

    expect(host.children).toEqual([printerB]);
    expect(printerA.parent).toBeNull();
    expect(printerB.parent).toBe(host);

    // An old Suspense/StrictMode cleanup must not detach the replacement.
    releaseA();
    expect(host.children).toEqual([printerB]);

    releaseB();
    expect(host.children).toHaveLength(0);
  });

  it("is idempotent across StrictMode cleanup and remount", () => {
    const host = new THREE.Group();
    const printer = new THREE.Group();

    const firstRelease = attachExclusiveScene(host, printer);
    firstRelease();
    firstRelease();
    expect(host.children).toHaveLength(0);

    const secondRelease = attachExclusiveScene(host, printer);
    expect(host.children).toEqual([printer]);
    expect(host.children.filter((child) => child === printer)).toHaveLength(1);

    secondRelease();
    expect(printer.parent).toBeNull();
  });
});
