import { expect, test } from "bun:test";
import { createCanvasRuntime } from "../controller/runtime";
import { readLayout } from "../layout";
import { navigateFrame } from "./navigation";
import { type FrameMessage, frameProtocol } from "./protocol";

test("only the selected frame can send viewport input", () => {
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    const items = ["form", "controls"].map((id) => ({
      id,
      name: id,
      width: 400,
      height: 400,
      position: { x: 0, y: 0 },
    }));
    const initial = readLayout(null, items);
    const runtime = createCanvasRuntime({ id: "test", name: "Test", items }, initial, () => {});
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
