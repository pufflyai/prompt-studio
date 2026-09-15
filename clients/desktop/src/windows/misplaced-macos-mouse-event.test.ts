import { describe, expect, it } from "bun:test";
import type { MouseInputEvent } from "electron";
import { isMisplacedMacosMouseMove } from "./misplaced-macos-mouse-event";

const stationaryMove: MouseInputEvent = {
  type: "mouseMove",
  button: "left",
  x: 400.390625,
  y: 1005.03515625,
  globalX: 204.390625,
  globalY: -74.96484375,
  movementX: 0,
  movementY: 0,
};
const coordinates = (cursor = { x: 8, y: -1057 }) => ({
  cursor,
  windowBounds: { x: -196, y: -1080, width: 1920, height: 1080 },
  primaryScreenHeight: 982,
});

describe("macOS full-screen mouse coordinates", () => {
  it("rejects a stationary event that jumps away from the actual pointer", () => {
    expect(isMisplacedMacosMouseMove(stationaryMove, coordinates)).toBe(true);
  });

  it("preserves a stationary event at the pointer, including coordinate rounding", () => {
    const mouse = { ...stationaryMove, globalX: 8.390625, globalY: -1056.96484375 };
    expect(isMisplacedMacosMouseMove(mouse, coordinates)).toBe(false);
  });

  it("preserves real horizontal and vertical movement while the cursor advances", () => {
    for (const movement of [{ movementX: 3 }, { movementY: -2 }]) {
      expect(isMisplacedMacosMouseMove({ ...stationaryMove, ...movement }, coordinates)).toBe(false);
    }
  });

  it("preserves input from another source that does not match the native coordinate error", () => {
    expect(isMisplacedMacosMouseMove(stationaryMove, () => coordinates({ x: 600, y: -800 }))).toBe(false);
  });

  it("uses the current display arrangement instead of a fixed offset", () => {
    const geometry = () => ({
      cursor: { x: 1700, y: 0 },
      windowBounds: { x: 1512, y: -200, width: 1920, height: 1080 },
      primaryScreenHeight: 982,
    });
    const mouse = { ...stationaryMove, globalX: 188, globalY: 102 };
    expect(isMisplacedMacosMouseMove(mouse, geometry)).toBe(true);
    expect(isMisplacedMacosMouseMove(stationaryMove, geometry)).toBe(false);
  });

  it("preserves presses, releases, hover, and other mouse buttons", () => {
    const inputs: MouseInputEvent[] = [
      { ...stationaryMove, type: "mouseDown" },
      { ...stationaryMove, type: "mouseUp" },
      { ...stationaryMove, button: undefined },
      { ...stationaryMove, button: "right" },
    ];
    for (const mouse of inputs) expect(isMisplacedMacosMouseMove(mouse, coordinates)).toBe(false);
  });
});
