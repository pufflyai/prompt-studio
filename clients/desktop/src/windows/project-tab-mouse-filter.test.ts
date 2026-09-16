import { describe, expect, it } from "bun:test";
import type { MouseInputEvent } from "electron";
import { createProjectTabMouseFilter } from "./project-tab-mouse-filter";

const press: MouseInputEvent = {
  type: "mouseDown",
  button: "left",
  x: 204.390625,
  y: 23.03515625,
  globalX: 8.390625,
  globalY: -1056.96484375,
  movementX: 0,
  movementY: 0,
};
const misplaced: MouseInputEvent = {
  ...press,
  type: "mouseMove",
  x: 400.390625,
  y: 1005.03515625,
  globalX: 204.390625,
  globalY: -74.96484375,
};
const setup = () => {
  const cursor = { x: 8, y: -1057 };
  const filter = createProjectTabMouseFilter(() => ({
    cursor,
    windowBounds: { x: -196, y: -1080, width: 1920, height: 1080 },
    primaryScreenHeight: 982,
  }));
  filter.setTabBounds([{ x: 190, y: 9, width: 120, height: 26 }]);
  return { filter, cursor };
};

describe("project tab mouse isolation", () => {
  it("filters the captured misplaced movement during a stationary tab press", () => {
    const { filter } = setup();
    expect(filter.shouldSuppress(press)).toBe(false);
    expect(filter.shouldSuppress(misplaced)).toBe(true);
    expect(filter.shouldSuppress({ ...press, type: "mouseUp" })).toBe(false);
  });

  it("passes that movement without a tab press, including content and adjacent controls", () => {
    for (const origin of [undefined, { x: 204, y: 200 }, { x: 312, y: 23 }, { x: 400, y: 23 }]) {
      const { filter } = setup();
      if (origin) filter.shouldSuppress({ ...press, ...origin });
      expect(filter.shouldSuppress(misplaced)).toBe(false);
    }
  });

  it("stops filtering once a drag moves, even if it returns to its start", () => {
    const { filter } = setup();
    filter.shouldSuppress(press);
    expect(filter.shouldSuppress({ ...press, type: "mouseMove", movementX: 8 })).toBe(false);
    expect(filter.shouldSuppress(misplaced)).toBe(false);
  });

  it("leaves injected movement unchanged and stops filtering that gesture", () => {
    const { filter } = setup();
    filter.shouldSuppress(press);
    expect(filter.shouldSuppress({ ...press, type: "mouseMove", globalX: 100 })).toBe(false);
    expect(filter.shouldSuppress(misplaced)).toBe(false);
  });

  it("stops when the actual cursor moves before the next event is delivered", () => {
    const { filter, cursor } = setup();
    filter.shouldSuppress(press);
    cursor.x += 10;
    expect(filter.shouldSuppress(misplaced)).toBe(false);
    cursor.x -= 10;
    expect(filter.shouldSuppress(misplaced)).toBe(false);
  });

  it("clears the press on release, cancellation, geometry changes, and lost buttons", () => {
    for (const end of ["release", "cancel", "bounds", "buttons", "leave"] as const) {
      const { filter } = setup();
      filter.shouldSuppress(press);
      if (end === "release") filter.shouldSuppress({ ...press, type: "mouseUp" });
      if (end === "cancel") filter.reset();
      if (end === "bounds") filter.setTabBounds([]);
      if (end === "buttons") filter.shouldSuppress({ ...press, type: "mouseMove", button: undefined });
      if (end === "leave") filter.shouldSuppress({ ...press, type: "mouseLeave" });
      expect(filter.shouldSuppress(misplaced)).toBe(false);
    }
  });

  it("preserves stationary events and other buttons", () => {
    const { filter } = setup();
    filter.shouldSuppress(press);
    expect(filter.shouldSuppress({ ...press, type: "mouseMove" })).toBe(false);
    expect(filter.shouldSuppress(misplaced)).toBe(true);
    filter.shouldSuppress({ ...press, button: "right" });
    expect(filter.shouldSuppress(misplaced)).toBe(false);
  });
});
