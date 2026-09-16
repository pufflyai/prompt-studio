import type { MouseInputEvent, Point, Rectangle } from "electron";
import { isMisplacedMacosMouseMove, type MacosMouseCoordinates } from "./misplaced-macos-mouse-event";

const samePoint = (a: Point, b: Point) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

export const createProjectTabMouseFilter = (readCoordinates: () => MacosMouseCoordinates) => {
  let tabs: Rectangle[] = [];
  let press: Point | null = null;
  const reset = () => {
    press = null;
  };
  return {
    reset,
    setTabBounds: (bounds: Rectangle[]) => {
      tabs = bounds;
      reset();
    },
    shouldSuppress: (mouse: MouseInputEvent) => {
      const { globalX, globalY } = mouse;
      if (mouse.type === "mouseDown") {
        reset();
        const onTab = tabs.some(
          ({ x, y, width, height }) => mouse.x >= x && mouse.x < x + width && mouse.y >= y && mouse.y < y + height,
        );
        if (mouse.button === "left" && onTab && globalX !== undefined && globalY !== undefined) {
          press = { x: globalX, y: globalY };
        }
        return false;
      }
      if (mouse.type !== "mouseMove" || mouse.button !== "left" || mouse.movementX !== 0 || mouse.movementY !== 0) {
        reset();
        return false;
      }
      if (!press) return false;
      const coordinates = readCoordinates();
      if (!samePoint(coordinates.cursor, press)) {
        reset();
        return false;
      }
      if (isMisplacedMacosMouseMove(mouse, () => coordinates)) return true;
      if (globalX === undefined || globalY === undefined || !samePoint({ x: globalX, y: globalY }, press)) reset();
      return false;
    },
  };
};
