import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import { defineFrame } from "./frame";
import {
  getSurface,
  listAnchorAreas,
  listProjectionAreas,
  listProjectionsReading,
  resolveAnchorArea,
} from "./frame-queries";

const alternateFrame = defineFrame({
  id: "alternate",
  root: {
    kind: "split",
    id: "alternate-root",
    direction: "row",
    children: [
      { kind: "slot", id: "subject", owner: "resource", role: "panels" },
      { kind: "slot", id: "details", owner: "resource", role: "projection", reads: ["primary"] },
      { kind: "slot", id: "sessions", owner: "project", role: "panels" },
    ],
  },
  primary: "subject",
  attached: { slot: "sessions", persistence: "detached", candidates: "scoped" },
});

describe("frame queries", () => {
  test("query classic frame roles and anchor bindings", () => {
    expect(getSurface(classicFrame, "main")).toMatchObject({ role: "panels" });
    expect(listAnchorAreas(classicFrame)).toEqual(["main", "secondary", "floating"]);
    expect(listProjectionAreas(classicFrame)).toContain("main-left");
    expect(listProjectionAreas(classicFrame)).toContain("status");
    expect(listProjectionsReading(classicFrame, "attached")).toEqual(
      expect.arrayContaining(["nav", "status", "floating-header"]),
    );
    expect(resolveAnchorArea(classicFrame, "primary")).toBe("main");
    expect(resolveAnchorArea(classicFrame, "secondary")).toBe("secondary");
    expect(resolveAnchorArea(classicFrame, "attached")).toBe("floating");
  });

  test("query a non-classic frame without consulting module globals", () => {
    expect(getSurface(alternateFrame, "details")).toMatchObject({ role: "projection", reads: ["primary"] });
    expect(listAnchorAreas(alternateFrame)).toEqual(["subject", "sessions"]);
    expect(listProjectionAreas(alternateFrame)).toEqual(["details"]);
    expect(listProjectionsReading(alternateFrame, "primary")).toEqual(["details"]);
    expect(resolveAnchorArea(alternateFrame, "primary")).toBe("subject");
    expect(resolveAnchorArea(alternateFrame, "secondary")).toBeUndefined();
    expect(resolveAnchorArea(alternateFrame, "attached")).toBe("sessions");
  });
});
