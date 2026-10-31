import { expect, test } from "bun:test";
import { type FrameMessage, frameProtocol } from "@pstdio/canvas";
import { createCanvasRuntime } from "../controller/runtime";
import { readLayout } from "../layout";
import { testItems } from "../test-build";
import { navigateFrame } from "./navigation";

test("only the selected frame can send viewport input", () => {
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    const items = testItems(["form", "controls"]);
    const initial = readLayout(null, items);
    const runtime = createCanvasRuntime({ id: "test", name: "Test", group: "", items }, initial, () => {});
    const pan = { protocol: frameProtocol, type: "pan", deltaX: 20, deltaY: 30 } satisfies FrameMessage;
    navigateFrame(pan, "form", runtime);
    expect(runtime.get().camera).toEqual(initial.camera);
    runtime.select("form");
    navigateFrame(pan, "form", runtime);
    const moved = { ...initial.camera, x: initial.camera.x + 20, y: initial.camera.y + 30 };
    expect(runtime.get().camera).toEqual(moved);
    runtime.select("controls");
    navigateFrame(pan, "form", runtime);
    expect(runtime.get().camera).toEqual(moved);
    runtime.flush();
  } finally {
    globalThis.requestAnimationFrame = original;
  }
});
