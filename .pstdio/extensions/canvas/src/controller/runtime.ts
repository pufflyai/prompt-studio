import type { CanvasDefinition } from "../canvases/definitions";
import type { Layout, LayoutChange } from "../layout";
import { boundedCamera, boundedPoint, type Camera, fitCamera, type Point, revealCamera, zoomAt } from "./geometry";

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
  const sizes = new Map<string, { width: number; height: number }>();
  const moved = new Set<string>();
  const listeners = new Set<() => void>();
  let cameraDirty = true;
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
  const camera = (next: Camera) => {
    layout = { ...layout, camera: boundedCamera(next) };
    cameraDirty = true;
    changes.camera = layout.camera;
    changed();
  };
  const viewport = () => ({ width: shell?.clientWidth ?? 1, height: shell?.clientHeight ?? 1 });
  const bounds = (id?: string) => {
    const entries = canvas.items
      .filter((item) => !id || item.id === id)
      .map((item) => {
        const position = layout.positions[item.id];
        const size = sizes.get(item.id) ?? { width: item.width, height: item.height + 36 };
        return { ...position, ...size };
      });
    const left = Math.min(...entries.map((entry) => entry.x));
    const top = Math.min(...entries.map((entry) => entry.y));
    return {
      x: left,
      y: top,
      width: Math.max(...entries.map((entry) => entry.x + entry.width)) - left,
      height: Math.max(...entries.map((entry) => entry.y + entry.height)) - top,
    };
  };
  const reveal = (id: string) => {
    if (!items.has(id)) return;
    raise(id);
    const rect = bounds(id);
    const view = viewport();
    const zoom = layout.camera.zoom;
    camera({
      zoom,
      x: (view.width - rect.width * zoom) / 2 - rect.x * zoom,
      y: (view.height - rect.height * zoom) / 2 - rect.y * zoom,
    });
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
      for (const [id, element] of items) sizes.set(id, { width: element.offsetWidth, height: element.offsetHeight });
    },
    elements: () => [...items.values()],
    camera,
    pan: (delta: Point) => camera({ ...layout.camera, x: layout.camera.x + delta.x, y: layout.camera.y + delta.y }),
    zoom: (factor: number, anchor?: Point) => {
      const view = viewport();
      camera(zoomAt(layout.camera, anchor ?? { x: view.width / 2, y: view.height / 2 }, layout.camera.zoom * factor));
    },
    move: (id: string, delta: Point) => {
      const current = layout.positions[id];
      if (!current) return;
      layout = {
        ...layout,
        positions: { ...layout.positions, [id]: boundedPoint({ x: current.x + delta.x, y: current.y + delta.y }) },
      };
      changes.positions = { ...changes.positions, [id]: layout.positions[id] };
      moved.add(id);
      changed();
    },
    fit: () => {
      if (canvas.items.length) camera(fitCamera(bounds(), viewport()));
    },
    reset: () => camera({ x: 24, y: 24, zoom: 1 }),
    reveal,
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
      layout = next;
      cameraDirty = true;
      for (const item of canvas.items) moved.add(item.id);
      schedule();
    },
    flush,
    dispose: () => {
      flush();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      foreground = undefined;
      listeners.clear();
      items.clear();
    },
  };
};
export type CanvasRuntime = ReturnType<typeof createCanvasRuntime>;
