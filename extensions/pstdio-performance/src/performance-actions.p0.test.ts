import { expect, test } from "bun:test";
import { createPerformanceActions } from "./performance-actions";

const overlayState = (enabled: boolean) => ({ supported: true, enabled, scope: "workbench" as const });

test("an older observation cannot replace a pending highlight choice or its confirmation", async () => {
  const oldRead = Promise.withResolvers<ReturnType<typeof overlayState>>();
  const finish = Promise.withResolvers<void>();
  let reads = 0;
  let writes = 0;
  const actions = createPerformanceActions({
    readOverlay: async () => {
      reads += 1;
      if (reads === 2) return oldRead.promise;
      return overlayState(reads > 2);
    },
    async writeOverlay() {
      writes += 1;
      await finish.promise;
    },
    copy: async () => true,
    setPaused: async () => {},
  });
  await actions.refreshOverlay();
  const reading = actions.refreshOverlay();
  const writing = actions.setOverlay(true);
  expect(actions.snapshot()).toMatchObject({ renderOverlay: overlayState(false), overlayIntent: true });
  await actions.setOverlay(false);
  expect(writes).toBe(1);

  finish.resolve();
  await writing;
  expect(actions.snapshot()).toMatchObject({ renderOverlay: overlayState(true), overlayIntent: undefined });
  oldRead.resolve(overlayState(false));
  await reading;
  expect(actions.snapshot().renderOverlay).toEqual(overlayState(true));
});

test("a failed highlight change restores the confirmed value while unrelated actions proceed", async () => {
  const pending = Promise.withResolvers<void>();
  const copying = Promise.withResolvers<boolean>();
  const paused: string[] = [];
  const actions = createPerformanceActions({
    readOverlay: async () => overlayState(false),
    writeOverlay: () => pending.promise,
    copy: () => copying.promise,
    setPaused: async (id) => {
      paused.push(id);
    },
  });
  await actions.refreshOverlay();
  const change = actions.setOverlay(true);
  const copy = actions.copy();
  expect(actions.snapshot()).toMatchObject({ overlayIntent: true, copying: true });
  await actions.setPaused("extension-a", true);
  expect(paused).toEqual(["extension-a"]);
  pending.reject(new Error("Highlighting failed"));
  await expect(change).rejects.toThrow("Highlighting failed");
  expect(actions.snapshot()).toMatchObject({ renderOverlay: overlayState(false), overlayIntent: undefined });
  expect(actions.snapshot().copying).toBe(true);
  copying.resolve(true);
  expect(await copy).toBe(true);
  expect(actions.snapshot().copying).toBe(false);
});

test("an extension control stays busy under one admission while another extension can change", async () => {
  const finish = Promise.withResolvers<void>();
  const changed: string[] = [];
  const actions = createPerformanceActions({
    readOverlay: async () => overlayState(false),
    writeOverlay: async () => {},
    copy: async () => false,
    async setPaused(id) {
      changed.push(id);
      if (id === "extension-a") await finish.promise;
    },
  });
  const first = actions.setPaused("extension-a", true);
  expect(actions.snapshot().pendingExtensions).toEqual(new Set(["extension-a"]));
  await actions.setPaused("extension-a", false);
  await actions.setPaused("extension-b", true);
  expect(changed).toEqual(["extension-a", "extension-b"]);
  expect(actions.snapshot().pendingExtensions).toEqual(new Set(["extension-a"]));
  finish.resolve();
  await first;
  expect(actions.snapshot().pendingExtensions.size).toBe(0);
});

test("a failed read-back keeps the acknowledged overlay value visible without replay", async () => {
  let enabled = false;
  let failRead = false;
  let writes = 0;
  const actions = createPerformanceActions({
    readOverlay: async () => {
      if (failRead) throw new Error("Read-back unavailable");
      return overlayState(enabled);
    },
    async writeOverlay(next) {
      writes += 1;
      enabled = next;
      failRead = true;
    },
    copy: async () => false,
    setPaused: async () => {},
  });
  await actions.refreshOverlay();
  await expect(actions.setOverlay(true)).rejects.toThrow("Read-back unavailable");
  expect(actions.snapshot().renderOverlay).toEqual(overlayState(true));

  await actions.refreshOverlay();
  expect(actions.snapshot().renderOverlay).toEqual(overlayState(true));
  failRead = false;
  await actions.refreshOverlay();
  expect(actions.snapshot().renderOverlay).toEqual(overlayState(true));
  expect(writes).toBe(1);
});
