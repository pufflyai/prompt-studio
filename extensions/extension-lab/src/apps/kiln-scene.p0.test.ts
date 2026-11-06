import { expect, mock, test } from "bun:test";
import * as Three from "three";
import { exampleDefaults } from "../state-defaults";
import type { ExampleHost } from "../view-context";
import { kilnStore } from "./kiln-state";

test("unchanged editing, page and size notifications retain the painted scene", async () => {
  const actualThree = { ...Three };
  const actualControls = { ...(await import("three/addons/controls/OrbitControls.js")) };
  const originals = {
    window: globalThis.window,
    styles: globalThis.getComputedStyle,
    observer: globalThis.ResizeObserver,
    getState: kilnStore.getState,
    subscribe: kilnStore.subscribe,
  };
  let draws = 0;
  let sizes = 0;
  let disposed = false;
  let id = 0;
  let resize = () => {};
  let changed = () => {};
  let pageChanged = () => {};
  let state = structuredClone(exampleDefaults.kiln);
  let selection = "cube";
  const pending = new Map<number, FrameRequestCallback>();
  const paint = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback(0);
  };
  const size = new Three.Vector2();
  class Renderer {
    shadowMap = {};
    setPixelRatio() {}
    setSize(width: number, height: number) {
      size.set(width, height);
      sizes++;
    }
    getSize(target: Three.Vector2) {
      return target.copy(size);
    }
    render() {
      expect(disposed).toBe(false);
      draws++;
    }
    dispose() {
      disposed = true;
    }
  }
  class Controls {
    target = new Three.Vector3();
    update() {}
    saveState() {}
    listenToKeyEvents() {}
    addEventListener() {}
    reset() {}
    dispose() {}
  }
  mock.module("three", () => ({ ...actualThree, WebGLRenderer: Renderer }));
  mock.module("three/addons/controls/OrbitControls.js", () => ({ OrbitControls: Controls }));
  Object.assign(globalThis, {
    getComputedStyle: () => ({ getPropertyValue: () => "#888888" }),
    window: {
      devicePixelRatio: 1,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        pending.set(++id, callback);
        return id;
      },
      cancelAnimationFrame: (key: number) => pending.delete(key),
    },
    ResizeObserver: class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  });
  kilnStore.getState = () => state;
  kilnStore.subscribe = (listener) => {
    changed = listener;
    return () => {};
  };
  const host = {
    page: {
      params: () => ({ selection }),
      subscribe: (listener: () => void) => {
        pageChanged = listener;
        return () => {};
      },
    },
  } as unknown as ExampleHost;
  const canvas = {
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
    addEventListener() {},
    removeEventListener() {},
  } as unknown as HTMLCanvasElement;
  let scene: { dispose(): void } | undefined;
  try {
    const { createKilnScene } = await import("./kiln-scene");
    scene = createKilnScene(canvas, host);
    paint();
    expect(draws).toBe(1);
    for (const notify of [pageChanged, resize, changed]) {
      state = structuredClone(state);
      notify();
      paint();
    }
    expect({ draws, sizes }).toEqual({ draws: 1, sizes: 1 });
    selection = "sphere";
    pageChanged();
    paint();
    state = { ...state, frame: state.frame + 1 };
    changed();
    paint();
    state.objectStates.cube.position[0] = 2.5;
    changed();
    paint();
    expect(draws).toBe(4);
    state = { ...state, frame: state.frame + 1 };
    changed();
    scene.dispose();
    paint();
    expect(draws).toBe(4);
  } finally {
    if (!disposed) scene?.dispose();
    kilnStore.getState = originals.getState;
    kilnStore.subscribe = originals.subscribe;
    Object.assign(globalThis, {
      window: originals.window,
      getComputedStyle: originals.styles,
      ResizeObserver: originals.observer,
    });
    mock.module("three", () => actualThree);
    mock.module("three/addons/controls/OrbitControls.js", () => actualControls);
  }
});
