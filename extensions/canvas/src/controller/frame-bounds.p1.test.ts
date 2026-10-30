import { expect, test } from "bun:test";
import { measureItem } from "./frame-bounds";

test("preview anchors include positioned wrappers and their borders", () => {
  const item = { offsetWidth: 1200, offsetHeight: 900, clientLeft: 0, clientTop: 0, querySelector: () => frame };
  const wrapper = { offsetLeft: 10, offsetTop: 40, clientLeft: 1, clientTop: 1, offsetParent: item };
  const frame = { offsetLeft: 3, offsetTop: 4, offsetParent: wrapper };
  expect(measureItem(item as unknown as HTMLElement)).toEqual({ width: 1200, height: 900, frame: { x: 14, y: 45 } });
});
