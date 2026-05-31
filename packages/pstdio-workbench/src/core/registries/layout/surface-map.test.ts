import { describe, expect, test } from "bun:test";
import { workbenchAreas } from "./layout-types";
import {
  getSurface,
  listAnchorAreas,
  listProjectionAreas,
  listProjectionsReading,
  resolveAnchorArea,
  surfaceMap,
} from "./surface-map";

describe("surfaceMap", () => {
  test("describes every workbench area", () => {
    for (const area of workbenchAreas) {
      expect(getSurface(area)).toBeDefined();
    }
  });

  test("main is the primary anchor (global candidates)", () => {
    expect(getSurface("main")).toMatchObject({
      role: "anchor",
      anchor: "primary",
      persistence: "primary",
      candidates: "global",
    });
  });

  test("secondary is the secondary anchor — derived + scoped (terminals)", () => {
    expect(getSurface("secondary")).toMatchObject({
      role: "anchor",
      anchor: "secondary",
      persistence: "derived",
      candidates: "scoped",
    });
  });

  test("floating is the attached anchor — detached + scoped (sessions)", () => {
    expect(getSurface("floating")).toMatchObject({
      role: "anchor",
      anchor: "attached",
      persistence: "detached",
      candidates: "scoped",
    });
  });

  test("main side panels are projections that read primary", () => {
    expect(getSurface("main-left")).toMatchObject({ role: "projection", reads: ["primary"] });
    expect(getSurface("main-right")).toMatchObject({ role: "projection", reads: ["primary"] });
  });

  test("status reads both primary and attached", () => {
    expect(getSurface("status")).toMatchObject({ role: "projection", reads: ["primary", "attached"] });
  });

  test("nav is a projection (breadcrumbs + session), not chrome", () => {
    expect(getSurface("nav")).toMatchObject({ role: "projection", reads: ["primary", "attached"] });
  });

  test("left is a navigator projection that selects primary", () => {
    expect(getSurface("left")).toMatchObject({ role: "projection", reads: ["primary"], navigator: true });
  });

  test("overlay is the transient layer", () => {
    expect(getSurface("overlay")).toMatchObject({ role: "transient" });
  });

  test("resolves an anchor id back to its area", () => {
    expect(resolveAnchorArea("primary")).toBe("main");
    expect(resolveAnchorArea("secondary")).toBe("secondary");
    expect(resolveAnchorArea("attached")).toBe("floating");
  });

  test("lists anchor areas and projection areas", () => {
    expect(listAnchorAreas().sort()).toEqual(["floating", "main", "secondary"]);
    expect(listProjectionAreas()).toContain("main-left");
    expect(listProjectionAreas()).toContain("status");
  });

  test("lists projections that read a given anchor", () => {
    const readsAttached = listProjectionsReading("attached");
    expect(readsAttached).toContain("status");
    expect(readsAttached).toContain("floating-header");
  });

  test("surfaceMap covers exactly the workbench areas", () => {
    expect(Object.keys(surfaceMap).sort()).toEqual([...workbenchAreas].sort());
  });
});
