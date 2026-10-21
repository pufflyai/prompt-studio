import { expect, test } from "bun:test";
import { resolvePanelDropTarget } from "./panel-drop-collision";

const left = { id: "left", rect: { left: 0, right: 48, top: 0, bottom: 800 } };
const top = { id: "top", rect: { left: 48, right: 1200, top: 0, bottom: 48 } };

test("release near the pointer's drag start keeps the current placement", () => {
  expect(resolvePanelDropTarget({ x: 1030, y: 420 }, { x: 1050, y: 400 }, [left])).toBeUndefined();
});

test("the cancellation area follows the actual grab point", () => {
  const pointer = { x: 600, y: 400 };
  expect(resolvePanelDropTarget(pointer, { x: 620, y: 400 }, [left])).toBeUndefined();
  expect(resolvePanelDropTarget(pointer, { x: 1190, y: 400 }, [left])).toBe("left");
});

test("approaching a destination selects it and returning toward the start clears it", () => {
  const origin = { x: 1100, y: 750 };
  expect(resolvePanelDropTarget({ x: 240, y: 400 }, origin, [left, top])).toBe("left");
  expect(resolvePanelDropTarget({ x: 600, y: 100 }, origin, [left, top])).toBe("top");
  expect(resolvePanelDropTarget({ x: 1000, y: 700 }, origin, [left, top])).toBeUndefined();
});
