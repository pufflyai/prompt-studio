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

test("zoom keeps the same point in a frame under the pointer including its header offset", () => {
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    const item = { id: "frame", name: "Frame", position: { x: 1280, y: 100 }, width: 1200, height: 960 };
    const runtime = createCanvasRuntime(
      { id: "group", name: "Group", items: [item] },
      readLayout({ version: 1, camera: { x: 20, y: 30, zoom: 0.4 } }, [item]),
      () => {},
    );
    runtime.register(item.id, {
      offsetWidth: 1200,
      offsetHeight: 1028,
      style: {},
      querySelector: (selector: string) => (selector.startsWith("iframe") ? { offsetLeft: 1, offsetTop: 64 } : null),
    } as unknown as HTMLElement);
    runtime.measure();
    const point = { x: 560, y: 400 };
    const anchor = runtime.frameAnchor(item.id, point);
    expect(anchor.x).toBeCloseTo(756.4, 6);
    expect(anchor.y).toBeCloseTo(255.6, 6);
    runtime.zoom(1.35, anchor);
    const after = runtime.frameAnchor(item.id, point);
    expect(after.x).toBeCloseTo(anchor.x, 6);
    expect(after.y).toBeCloseTo(anchor.y, 6);
    runtime.flush();
  } finally {
    globalThis.requestAnimationFrame = original;
  }
});

test("group rows follow measured height while saved manual positions and themes stay independent", () => {
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: `frame-${index}`,
      name: `Frame ${index}`,
      width: 1200,
      height: 240,
      position: { x: (index % 4) * 1280, y: Math.floor(index / 4) * 1100 },
    }));
    const canvas = { id: "group", name: "Group", items, layout: "grid" as const };
    const initial = readLayout(null, items);
    const runtime = createCanvasRuntime(canvas, initial, () => {});
    const tall = { offsetWidth: 1200, offsetHeight: 4000, style: {}, querySelector: () => null };
    runtime.register(items[0].id, tall as unknown as HTMLElement);
    runtime.measure();
    expect(runtime.get().positions["frame-4"].y).toBe(4080);
    runtime.replace({ ...readLayout(null, items), themes: { "frame-0": "pstdio-dark" } });
    expect(runtime.get().positions["frame-4"].y).toBe(4080);
    const moved = readLayout(
      { version: 1, positions: { "frame-4": { x: 8000, y: 5000 } }, themes: { "frame-0": "pstdio-dark" } },
      items,
    );
    runtime.replace(moved);
    tall.offsetHeight = 6000;
    runtime.measure();
    expect(runtime.get().positions["frame-4"]).toEqual({ x: 8000, y: 5000 });
    expect(runtime.get().themes["frame-0"]).toBe("pstdio-dark");
  } finally {
    globalThis.requestAnimationFrame = original;
  }
});
