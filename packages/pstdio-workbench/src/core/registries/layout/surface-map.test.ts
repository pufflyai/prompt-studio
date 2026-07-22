import { describe, expect, test } from "bun:test";
import { workbenchRegions } from "./layout-types";
import {
  getSurface,
  listAnchorRegions,
  listProjectionRegions,
  listProjectionsReading,
  resolveAnchorRegion,
  surfaceMap,
} from "./surface-map";

describe("surfaceMap", () => {
  test("describes every workbench region", () => {
    for (const region of workbenchRegions) {
      expect(getSurface(region)).toBeDefined();
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

  test("Side Panel is the attached anchor — detached + scoped (sessions)", () => {
    expect(getSurface("side")).toMatchObject({
      role: "anchor",
      anchor: "attached",
      persistence: "detached",
      candidates: "scoped",
    });
  });

  test("Main Panel menus are projections that read primary", () => {
    expect(getSurface("main-left-menu")).toMatchObject({ role: "projection", reads: ["primary"] });
    expect(getSurface("main-right-menu")).toMatchObject({ role: "projection", reads: ["primary"] });
  });

  test("status reads both primary and attached", () => {
    expect(getSurface("status")).toMatchObject({ role: "projection", reads: ["primary", "attached"] });
  });

  test("nav is a projection (breadcrumbs + session), not chrome", () => {
    expect(getSurface("nav")).toMatchObject({ role: "projection", reads: ["primary", "attached"] });
  });

  test("Sidenav is a navigator projection that selects primary", () => {
    expect(getSurface("sidenav")).toMatchObject({ role: "projection", reads: ["primary"], navigator: true });
  });

  test("overlay is the transient layer", () => {
    expect(getSurface("overlay")).toMatchObject({ role: "transient" });
  });

  test("resolves an anchor id back to its region", () => {
    expect(resolveAnchorRegion("primary")).toBe("main");
    expect(resolveAnchorRegion("secondary")).toBe("secondary");
    expect(resolveAnchorRegion("attached")).toBe("side");
  });

  test("lists anchor regions and projection regions", () => {
    expect(listAnchorRegions().sort()).toEqual(["main", "secondary", "side"]);
    expect(listProjectionRegions()).toContain("main-left-menu");
    expect(listProjectionRegions()).toContain("status");
  });

  test("lists projections that read a given anchor", () => {
    const readsAttached = listProjectionsReading("attached");
    expect(readsAttached).toContain("status");
    expect(readsAttached).toContain("side-header");
  });

  test("surfaceMap covers exactly the workbench regions", () => {
    expect(Object.keys(surfaceMap).sort()).toEqual([...workbenchRegions].sort());
  });
});
