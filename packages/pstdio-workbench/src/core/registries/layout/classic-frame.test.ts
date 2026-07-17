import { describe, expect, test } from "bun:test";
import { workbenchModeLayoutTargets } from "pstdio-api-contracts/extension-kernel";
import { classicFrame } from "./classic-frame";
import { defineFrame } from "./frame";
import type { SlotsOf } from "./frame-types";
import { resolveWorkbenchModeArea, workbenchModeTargets } from "./mode-layout-targets";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const expectedSlots = {
  nav: { role: "projection", reads: ["primary", "attached"] },
  activity: { role: "chrome" },
  left: { role: "projection", reads: ["primary"], navigator: true, regions: { header: "left-header" } },
  main: {
    role: "panels",
    regions: { header: "main-header", leftMenu: "main-left-menu", rightMenu: "main-right-menu" },
  },
  secondary: {
    role: "panels",
    regions: {
      header: "secondary-header",
      leftMenu: "secondary-left-menu",
      rightMenu: "secondary-right-menu",
    },
  },
  status: { role: "projection", reads: ["primary", "attached"] },
  overlay: { role: "transient" },
  side: {
    role: "panels",
    regions: { header: "side-header", leftMenu: "side-left-menu", rightMenu: "side-right-menu" },
  },
} as const;

type ClassicSlotId = keyof typeof expectedSlots;
type _FrameIndexMatchesDeclaredSlots = Expect<Equal<SlotsOf<typeof classicFrame>, ClassicSlotId>>;
const typeTripwire: _FrameIndexMatchesDeclaredSlots = true;
const classicSlotIds = Object.keys(expectedSlots) as ClassicSlotId[];

describe("classicFrame", () => {
  test("derives the classic slot vocabulary from the frame", () => {
    expect(typeTripwire).toBe(true);
  });

  test("keeps panel-owned regions out of the workbench area vocabulary", () => {
    expect(Object.keys(classicFrame.slots).sort()).toEqual([...classicSlotIds].sort());
  });

  test("preserves every surface role and projection binding", () => {
    for (const area of classicSlotIds) {
      expect(classicFrame.slots[area]).toMatchObject(expectedSlots[area]);
    }
  });

  test("preserves the three anchor bindings", () => {
    expect(classicFrame.primary).toBe("main");
    expect(classicFrame.secondary).toEqual({ slot: "secondary", persistence: "derived", candidates: "scoped" });
    expect(classicFrame.attached).toEqual({ slot: "side", persistence: "detached", candidates: "scoped" });
  });

  test("records target, companion, and size metadata for later frame consumers", () => {
    expect(classicSlotIds.filter((area) => classicFrame.slots[area].targetable)).toEqual([
      "left",
      "main",
      "secondary",
      "side",
    ]);
    expect(classicFrame.slots.side).toMatchObject({
      owner: "project",
      presentations: ["docked", "floating"],
      size: { defaultPx: 448, minPx: 320 },
    });
    expect(classicFrame.slots.secondary.size).toEqual({ defaultPx: 240, minPx: 128, maxPx: 420 });
    expect(classicFrame.slots.activity.size).toEqual({ defaultPx: 56, minPx: 56, maxPx: 56 });
    expect(classicFrame.slots.nav.size).toEqual({ defaultPx: 40, minPx: 40, maxPx: 40 });
    expect(classicFrame.slots.status.size).toEqual({ defaultPx: 28, minPx: 28, maxPx: 28 });
  });

  test("places the status bar after the panel row so it spans the full frame width", () => {
    expect(classicFrame.root).toMatchObject({
      kind: "split",
      id: "workbench",
      direction: "column",
      children: [{ id: "shell", direction: "row" }, { id: "status" }],
    });
  });

  test("keeps every mode target mapped to a targetable classic frame slot", () => {
    expect(Object.keys(workbenchModeTargets)).toEqual([...workbenchModeLayoutTargets]);
    for (const target of Object.values(workbenchModeTargets)) {
      const slot = classicFrame.slots[target.slot as keyof typeof classicFrame.slots];
      expect(slot.targetable).toBe(true);
      if (target.region) expect(classicFrame.regions[target.region]?.host).toBe(target.slot);
    }
  });

  test("diagnoses mode targets that the active frame cannot host", () => {
    const restrictedFrame = defineFrame({
      id: "restricted",
      root: { kind: "slot", id: "main", owner: "resource", role: "panels" },
      primary: "main",
    });

    expect(() => resolveWorkbenchModeArea(classicFrame, "workbench.typo")).toThrow(
      'Mode layout target "workbench.typo" is not available in frame "classic"',
    );
    expect(() => resolveWorkbenchModeArea(restrictedFrame, "workbench.main")).toThrow(
      'Mode layout target "workbench.main" is not available in frame "restricted"',
    );
  });
});
