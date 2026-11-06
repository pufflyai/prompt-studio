import { expect, test } from "bun:test";
import { createFrameRenderer } from "./frame-renderer";

const animationFrames = () => {
  let id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    request(callback: FrameRequestCallback) {
      pending.set(++id, callback);
      return id;
    },
    cancel(id: number) {
      pending.delete(id);
    },
    paint() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    },
  };
};

test("draws the latest scene once when several changes precede one paint", () => {
  const frames = animationFrames();
  let scene = "initial";
  const drawn: string[] = [];
  const renderer = createFrameRenderer(() => drawn.push(scene), frames);
  for (const state of ["loaded", "resized", "grid", "wireframe", "selection"]) {
    scene = state;
    renderer.render();
  }
  expect(drawn).toEqual([]);
  frames.paint();
  expect(drawn).toEqual(["selection"]);
  scene = "animation frame";
  renderer.render();
  frames.paint();
  expect(drawn).toEqual(["selection", "animation frame"]);
});

test("disposal cancels pending GPU work and prevents later draws", () => {
  const frames = animationFrames();
  let draws = 0;
  const renderer = createFrameRenderer(() => draws++, frames);
  renderer.render();
  renderer.dispose();
  frames.paint();
  renderer.render();
  frames.paint();
  expect(draws).toBe(0);
});
