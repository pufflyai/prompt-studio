import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import type { SlotsOf } from "./frame-types";
import { type WorkbenchArea, workbenchAreas } from "./layout-types";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type _SlotsMatchTheTuple = Expect<Equal<SlotsOf<typeof classicFrame>, (typeof workbenchAreas)[number]>>;
type _WorkbenchAreaIsUnchanged = Expect<Equal<WorkbenchArea, (typeof workbenchAreas)[number]>>;
const typeTripwire: [_SlotsMatchTheTuple, _WorkbenchAreaIsUnchanged] = [true, true];

const expectedSlots = {
  nav: { role: "projection", reads: ["primary", "attached"] },
  activity: { role: "chrome" },
  "left-header": { role: "projection", reads: ["primary"] },
  left: { role: "projection", reads: ["primary"], navigator: true },
  "main-header": { role: "projection", reads: ["primary"] },
  "main-left": { role: "projection", reads: ["primary"] },
  main: { role: "panels" },
  "main-right": { role: "projection", reads: ["primary"] },
  "secondary-header": { role: "projection", reads: ["primary"] },
  secondary: { role: "panels" },
  status: { role: "projection", reads: ["primary", "attached"] },
  overlay: { role: "transient" },
  "floating-header": { role: "projection", reads: ["attached"] },
  floating: { role: "panels" },
} as const;

describe("classicFrame", () => {
  test("keeps frame slots and WorkbenchArea narrowed to the tuple", () => {
    expect(typeTripwire).toEqual([true, true]);
  });

  test("preserves the complete workbench area vocabulary", () => {
    expect(Object.keys(classicFrame.slots).sort()).toEqual([...workbenchAreas].sort());
  });

  test("preserves every surface role and projection binding", () => {
    for (const area of workbenchAreas) {
      expect(classicFrame.slots[area]).toMatchObject(expectedSlots[area]);
    }
  });

  test("preserves the three anchor bindings", () => {
    expect(classicFrame.primary).toBe("main");
    expect(classicFrame.secondary).toEqual({ slot: "secondary", persistence: "derived", candidates: "scoped" });
    expect(classicFrame.attached).toEqual({ slot: "floating", persistence: "detached", candidates: "scoped" });
  });

  test("records target, companion, and size metadata for later frame consumers", () => {
    expect(workbenchAreas.filter((area) => classicFrame.slots[area].targetable)).toEqual([
      "left",
      "main-left",
      "main",
      "main-right",
      "secondary",
    ]);
    expect(classicFrame.slots["main-left"]).toMatchObject({
      companionOf: "main",
      size: { defaultPx: 240, minPx: 180, maxPx: 420 },
    });
    expect(classicFrame.slots["main-right"]).toMatchObject({
      companionOf: "main",
      size: { defaultPx: 320, minPx: 240, maxPx: 520 },
    });
    expect(classicFrame.slots.secondary.size).toEqual({ defaultPx: 240, minPx: 128, maxPx: 420 });
  });
});
