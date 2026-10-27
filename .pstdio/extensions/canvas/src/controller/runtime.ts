import { type CanvasZoomChange, zoomCanvas } from "@pstdio/ui/canvas";
import type { CanvasDefinition } from "../canvases/definitions";
import type { FrameTheme } from "../frame-themes";
import type { Layout, LayoutChange } from "../layout";
import { frameAnchor, type ItemBounds, measureItem } from "./frame-bounds";
import { boundedCamera, boundedPoint, type Camera, fitCamera, type Point, revealCamera, zoomAt } from "./geometry";
import { arrangeGrid, canvasBounds, defaultGridItems } from "./grid";

export const createCanvasRuntime = (
  canvas: CanvasDefinition,
  initial: Layout,
  save: (change: LayoutChange) => void,
) => {
  let layout = initial;
  let shell: HTMLElement | undefined;
  let stage: HTMLElement | undefined;
  let frame = 0;
  let focusFrame = 0;
  let foreground: HTMLElement | undefined;
  const raise = (id: string) => {
    const next = items.get(id);
    if (!next || foreground === next) return;
    foreground?.style.removeProperty("z-index");
    next.style.zIndex = "1";
    foreground = next;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  let changes: LayoutChange = {};
  const items = new Map<string, HTMLElement>();
  const sizes = new Map<string, ItemBounds>();
  const moved = new Set<string>();
  const automatic = defaultGridItems(canvas, initial);
  const listeners = new Set<() => void>();
  let cameraDirty = true;
  let framing: { kind: "all" } | { kind: "item"; id: string } | undefined;
  let measuredViewport = { width: 0, height: 0 };
  const paint = () => {
    frame = 0;
    if (stage && cameraDirty) {
      const { x, y, zoom } = layout.camera;
      stage.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
      cameraDirty = false;
    }
    for (const id of moved) {
      const position = layout.positions[id];
      const item = items.get(id);
      if (item && position) item.style.transform = `translate(${position.x}px, ${position.y}px)`;
    }
    moved.clear();
    for (const listener of listeners) listener();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const flush = () => {
    clearTimeout(timer);
    if (dirty) {
      const patch = changes;
      changes = {};
      dirty = false;
      save(structuredClone(patch));
    }
  };
  const changed = () => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
    schedule();
  };
  const camera = (next: Camera, retainFraming = false) => {
    if (!retainFraming) framing = undefined;
    layout = { ...layout, camera: boundedCamera(next) };
    cameraDirty = true;
    changes.camera = layout.camera;
    changed();
  };
  const viewport = () => ({ width: shell?.clientWidth ?? 1, height: shell?.clientHeight ?? 1 });
  const bounds = (id?: string) => canvasBounds(canvas, layout, sizes, id);
  const reframe = () => {
    if (!framing) return;
    const rect = bounds(framing.kind === "item" ? framing.id : undefined);
    const view = viewport();
    const zoom = layout.camera.zoom;
    if (framing.kind === "all" || rect.width * zoom > view.width - 48 || rect.height * zoom > view.height - 48) {
      camera(fitCamera(rect, view), true);
      return;
    }
    camera(
      {
        zoom,
        x: (view.width - rect.width * zoom) / 2 - rect.x * zoom,
        y: (view.height - rect.height * zoom) / 2 - rect.y * zoom,
      },
      true,
    );
  };
  const reveal = (id: string) => {
    if (!items.has(id)) return;
    raise(id);
    framing = { kind: "item", id };
    reframe();
  };
  return {
    get: () => layout,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    mount: (element: HTMLElement, content: HTMLElement) => {
      shell = element;
      stage = content;
      schedule();
    },
    register: (id: string, element: HTMLElement | null) => {
      if (!element) {
        items.delete(id);
        sizes.delete(id);
        return;
      }
      items.set(id, element);
      moved.add(id);
      schedule();
    },
    measure: () => {
      // Read all wrapper sizes together. Gestures use this cache without forcing layout.
      const view = viewport();
      let changed = view.width !== measuredViewport.width || view.height !== measuredViewport.height;
      measuredViewport = view;
      for (const [id, element] of items) {
        if (element.querySelector("[data-ui-canvas-loading]")) continue;
        const next = measureItem(element);
        const previous = sizes.get(id);
        changed ||= next.width !== previous?.width || next.height !== previous?.height;
        sizes.set(id, next);
      }
      if (changed && automatic.size) {
        arrangeGrid(canvas, layout, sizes, automatic, moved);
        schedule();
      }
      if (changed) reframe();
    },
    elements: () => [...items.values()],
    camera,
    pan: (delta: Point) => camera({ ...layout.camera, x: layout.camera.x + delta.x, y: layout.camera.y + delta.y }),
    frameAnchor: (id: string, point: Point) => frameAnchor(layout, sizes, id, point),
    zoomChange: (change: CanvasZoomChange) =>
      camera(zoomCanvas(layout.camera, change, { minZoom: 0.000001, maxZoom: 4 })),
    zoom: (factor: number, anchor?: Point) => {
      const view = viewport();
      camera(zoomAt(layout.camera, anchor ?? { x: view.width / 2, y: view.height / 2 }, layout.camera.zoom * factor));
    },
    move: (id: string, delta: Point) => {
      const current = layout.positions[id];
      if (!current) return;
      automatic.delete(id);
      framing = undefined;
      layout = {
        ...layout,
        positions: { ...layout.positions, [id]: boundedPoint({ x: current.x + delta.x, y: current.y + delta.y }) },
      };
      changes.positions = { ...changes.positions, [id]: layout.positions[id] };
      moved.add(id);
      changed();
    },
    setTheme: (id: string, theme: FrameTheme) => {
      if (!layout.positions[id]) return;
      layout = { ...layout, themes: { ...layout.themes, [id]: theme } };
      changes.themes = { ...changes.themes, [id]: theme };
      changed();
    },
    fit: () => {
      if (!canvas.items.length) return;
      framing = { kind: "all" };
      reframe();
    },
    reset: () => camera({ x: 24, y: 24, zoom: 1 }),
    reveal,
    revealRegion: (rect: { x: number; y: number; width: number; height: number }) => {
      const next = revealCamera(layout.camera, rect, viewport());
      if (next.x !== layout.camera.x || next.y !== layout.camera.y) camera(next);
    },
    revealFocus: (target: HTMLElement) => {
      const item = target.closest<HTMLElement>("[data-canvas-item]");
      if (!item || !shell) return;
      raise(item.dataset.canvasItem!);
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        if (!shell || !target.isConnected || !target.contains(document.activeElement)) return;
        const rect = target.getBoundingClientRect();
        const view = shell.getBoundingClientRect();
        const next = revealCamera(
          layout.camera,
          { x: rect.left - view.left, y: rect.top - view.top, width: rect.width, height: rect.height },
          viewport(),
        );
        if (next.x !== layout.camera.x || next.y !== layout.camera.y) camera(next);
        shell.scrollLeft = 0;
        shell.scrollTop = 0;
      });
    },
    replace: (next: Layout) => {
      if (dirty) return;
      framing = undefined;
      layout = next;
      cameraDirty = true;
      for (const item of canvas.items) {
        moved.add(item.id);
        const point = next.positions[item.id];
        if (point.x !== item.position.x || point.y !== item.position.y) automatic.delete(item.id);
      }
      if (automatic.size) arrangeGrid(canvas, layout, sizes, automatic, moved);
      schedule();
    },
    flush,
    dispose: () => {
      flush();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      frame = focusFrame = 0;
      framing = undefined;
      cameraDirty = true;
      listeners.clear();
      items.clear();
      sizes.clear();
    },
  };
};
export type CanvasRuntime = ReturnType<typeof createCanvasRuntime>;
