import { expect, test } from "bun:test";
import { readLayout } from "../layout";
import { createCanvasRuntime } from "./runtime";

test("fit and explicit reveal include updated tall panel and title bounds", () => {
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    const item = { id: "documentation", name: "Documentation", width: 640, height: 240, position: { x: 0, y: 0 } };
    const runtime = createCanvasRuntime(
      { id: "docs", name: "Docs", items: [item] },
      readLayout(null, [item]),
      () => {},
    );
    const panel = { offsetWidth: 640, offsetHeight: 4000, style: {}, querySelector: () => null };
    runtime.mount({ clientWidth: 1000, clientHeight: 700 } as HTMLElement, {} as HTMLElement);
    runtime.register(item.id, panel as unknown as HTMLElement);
    runtime.measure();
    runtime.reveal(item.id);
    const first = runtime.get().camera;
    expect(first.y).toBeGreaterThanOrEqual(24);
    expect(first.y + panel.offsetHeight * first.zoom).toBeLessThanOrEqual(676);
    panel.offsetHeight = 8000;
    runtime.measure();
    const second = runtime.get().camera;
    expect(second.zoom).toBeLessThan(first.zoom);
    expect(second.y + panel.offsetHeight * second.zoom).toBeLessThanOrEqual(676);
    runtime.pan({ x: 100, y: 20 });
    const manual = runtime.get().camera;
    panel.offsetHeight = 12000;
    runtime.measure();
    expect(runtime.get().camera).toEqual(manual);
  } finally {
    globalThis.requestAnimationFrame = original;
  }
});

test("fit ignores a loading placeholder and follows the completed content", () => {
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    const item = { id: "async-doc", name: "Async doc", width: 640, height: 240, position: { x: 0, y: 0 } };
    const runtime = createCanvasRuntime(
      { id: "async", name: "Async", items: [item] },
      readLayout(null, [item]),
      () => {},
    );
    let loading = true;
    const panel = { offsetWidth: 640, offsetHeight: 40, style: {}, querySelector: () => (loading ? {} : null) };
    runtime.mount({ clientWidth: 1000, clientHeight: 700 } as HTMLElement, {} as HTMLElement);
    runtime.register(item.id, panel as unknown as HTMLElement);
    runtime.measure();
    runtime.fit();
    expect(runtime.get().camera.zoom).toBe(1);
    loading = false;
    panel.offsetHeight = 7000;
    runtime.measure();
    const camera = runtime.get().camera;
    expect(camera.zoom).toBeLessThan(0.1);
    expect(camera.y + panel.offsetHeight * camera.zoom).toBeLessThanOrEqual(676);
  } finally {
    globalThis.requestAnimationFrame = original;
  }
});
