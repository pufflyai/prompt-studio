import { expect, test } from "bun:test";
import { createReactRenderOverlay } from "./react-render-overlay";

test("loads only on demand, shares one session and releases it on every stop", async () => {
  let loads = 0;
  let active = 0;
  const overlay = createReactRenderOverlay({
    isSupported: () => true,
    load: async () => {
      loads++;
      return () => {
        active++;
        return () => {
          active--;
        };
      };
    },
  });
  expect(overlay.state()).toEqual({ supported: true, enabled: false, scope: "workbench" });
  expect(loads).toBe(0);
  await Promise.all([overlay.setEnabled(true), overlay.setEnabled(true)]);
  expect(active).toBe(1);
  expect(loads).toBe(1);
  expect(overlay.state().enabled).toBe(true);
  overlay.setEnabled(false);
  expect(active).toBe(0);
  expect(overlay.state().enabled).toBe(false);
  await overlay.setEnabled(true);
  expect(active).toBe(1);
  overlay.setEnabled(false);
  expect(active).toBe(0);
});

test("stopping during the first import prevents a late session from starting", async () => {
  const loaded = Promise.withResolvers<() => () => void>();
  let starts = 0;
  const overlay = createReactRenderOverlay({ isSupported: () => true, load: () => loaded.promise });
  const enabling = overlay.setEnabled(true);
  overlay.setEnabled(false);
  loaded.resolve(() => {
    starts++;
    return () => {};
  });
  await enabling;
  expect(starts).toBe(0);
  expect(overlay.state().enabled).toBe(false);
});

test("unavailable renderers and loading failures leave highlighting off", async () => {
  let supported = false;
  const overlay = createReactRenderOverlay({
    isSupported: () => supported,
    load: async () => {
      throw new Error("Chunk unavailable");
    },
  });
  await expect(overlay.setEnabled(true)).rejects.toThrow("unavailable");
  supported = true;
  await expect(overlay.setEnabled(true)).rejects.toThrow("Chunk unavailable");
  expect(overlay.state().enabled).toBe(false);
});
