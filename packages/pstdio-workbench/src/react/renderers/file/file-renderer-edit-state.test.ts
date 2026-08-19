import { describe, expect, test } from "bun:test";
import {
  createFileEditController,
  nextLoadedRevision,
  readCachedFileContent,
  storeCachedFileContent,
} from "./file-renderer-edit-state";

const DEBOUNCE_MS = 5;
const tick = (ms = DEBOUNCE_MS * 3) => new Promise((resolve) => setTimeout(resolve, ms));

const createHarness = (input?: { failSaves?: number }) => {
  let failsLeft = input?.failSaves ?? 0;
  const saves: string[] = [];
  let loads = 0;
  const controller = createFileEditController({
    debounceMs: DEBOUNCE_MS,
    load: () => {
      loads += 1;
    },
    save: async (value) => {
      if (failsLeft > 0) {
        failsLeft -= 1;
        throw new Error("save failed");
      }
      saves.push(value);
    },
  });
  return { controller, saves, loads: () => loads };
};

describe("file edit controller", () => {
  test("a change equal to the loaded content schedules no save", async () => {
    const { controller, saves } = createHarness();
    controller.setBaseline("loaded");

    controller.handleChange("loaded");
    await tick();

    expect(saves).toEqual([]);
  });

  test("a real edit saves once and advances the baseline", async () => {
    const { controller, saves } = createHarness();
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    await tick();
    controller.handleChange("edited");
    await tick();

    expect(saves).toEqual(["edited"]);
  });

  test("reverting to the baseline before the debounce fires cancels the save", async () => {
    const { controller, saves } = createHarness();
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    controller.handleChange("loaded");
    await tick();

    expect(saves).toEqual([]);
  });

  test("a refresh while clean reloads immediately", () => {
    const { controller, loads } = createHarness();
    controller.setBaseline("loaded");

    controller.handleRefreshEvent();

    expect(loads()).toBe(1);
  });

  test("refreshes during a draft or save are dropped after the save succeeds", async () => {
    const { controller, saves, loads } = createHarness();
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    controller.handleRefreshEvent();
    controller.handleRefreshEvent();
    expect(loads()).toBe(0);

    await tick();

    expect(saves).toEqual(["edited"]);
    expect(loads()).toBe(0);
  });

  test("a refresh deferred across a failed save is dropped once a retry succeeds", async () => {
    const { controller, saves, loads } = createHarness({ failSaves: 1 });
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    controller.handleRefreshEvent();
    await tick();
    expect(saves).toEqual([]);

    controller.flush();
    await tick();

    expect(saves).toEqual(["edited"]);
    expect(loads()).toBe(0);
  });

  test("a newer draft made during a save is saved after the first save settles", async () => {
    const { controller, saves } = createHarness();
    controller.setBaseline("loaded");

    controller.handleChange("first");
    await tick(DEBOUNCE_MS + 1);
    controller.handleChange("second");
    await tick();

    expect(saves).toEqual(["first", "second"]);
  });

  test("a failed save keeps the draft and a flush retries it", async () => {
    const { controller, saves } = createHarness({ failSaves: 1 });
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    await tick();
    expect(saves).toEqual([]);

    controller.flush();
    await tick();

    expect(saves).toEqual(["edited"]);
  });

  test("flush saves a pending draft without waiting for the debounce", async () => {
    const { controller, saves } = createHarness();
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    controller.flush();
    await tick(1);

    expect(saves).toEqual(["edited"]);
  });
});

describe("nextLoadedRevision", () => {
  test("keeps the revision when a reload returns the same document", () => {
    const previous = { content: "same", loadKey: "a", revision: 3 };

    expect(nextLoadedRevision(previous, { content: "same" }, "a")).toBe(3);
  });

  test("bumps the revision when the content changed", () => {
    const previous = { content: "old", loadKey: "a", revision: 3 };

    expect(nextLoadedRevision(previous, { content: "new" }, "a")).toBe(4);
  });

  test("restarts at one for a different load key", () => {
    const previous = { content: "same", loadKey: "a", revision: 3 };

    expect(nextLoadedRevision(previous, { content: "same" }, "b")).toBe(1);
  });

  test("keeps the revision when the reload matches what the editor already shows", () => {
    const previous = { content: "loaded", loadKey: "a", revision: 3 };

    expect(nextLoadedRevision(previous, { content: "saved draft" }, "a", "saved draft")).toBe(3);
  });

  test("bumps the revision when the reload differs from the editor value", () => {
    const previous = { content: "loaded", loadKey: "a", revision: 3 };

    expect(nextLoadedRevision(previous, { content: "external change" }, "a", "saved draft")).toBe(4);
  });
});

describe("file content cache", () => {
  test("stores and reads the last loaded document per binding", () => {
    storeCachedFileContent("cache-test:a", { content: "hello" });

    expect(readCachedFileContent("cache-test:a")).toEqual({ content: "hello" });
    expect(readCachedFileContent("cache-test:missing")).toBeUndefined();
  });

  test("evicts the oldest binding beyond the limit", () => {
    for (let index = 0; index < 31; index += 1) {
      storeCachedFileContent(`cache-evict:${index}`, { content: String(index) });
    }

    expect(readCachedFileContent("cache-evict:0")).toBeUndefined();
    expect(readCachedFileContent("cache-evict:30")).toEqual({ content: "30" });
  });
});
