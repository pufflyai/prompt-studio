import type { MouseInputEvent, Point, Rectangle } from "electron";

export interface MacosMouseCoordinates {
  cursor: Point;
  windowBounds: Rectangle;
  primaryScreenHeight: number;
}

export const isMisplacedMacosMouseMove = (mouse: MouseInputEvent, readCoordinates: () => MacosMouseCoordinates) => {
  if (
    mouse.type !== "mouseMove" ||
    mouse.button !== "left" ||
    mouse.movementX !== 0 ||
    mouse.movementY !== 0 ||
    mouse.globalX === undefined ||
    mouse.globalY === undefined
  )
    return false;
  const { cursor, windowBounds, primaryScreenHeight } = readCoordinates();
  const { globalX, globalY } = mouse;
  // Native events use fractional points; Electron's cursor position uses integers.
  const matches = (point: Point) => Math.abs(globalX - point.x) <= 1 && Math.abs(globalY - point.y) <= 1;
  if (matches(cursor)) return false;
  // Recognize window-local Cocoa coordinates incorrectly treated as screen coordinates.
  return matches({
    x: cursor.x - windowBounds.x,
    y: cursor.y + primaryScreenHeight - windowBounds.height - windowBounds.y,
  });
};
