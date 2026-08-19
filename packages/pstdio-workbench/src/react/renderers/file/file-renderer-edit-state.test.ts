import { describe, expect, test } from "bun:test";
import {
  createFileEditController,
  nextLoadedRevision,
  readCachedFileContent,
  storeCachedFileContent,
} from "./file-renderer-edit-state";

const DEBOUNCE_MS = 5;
const tick = (ms = DEBOUNCE_MS * 3) => new Promise((resolve) => setTimeout(resolve, ms));

const binding = {
  rendererId: "planner.ticketContent",
  instanceId: "planner.ticketEditor:1",
  resourceUri: "dashboard-workbench://ticket/ticket-1",
};

const createHarness = (input?: { failSaves?: number; saveRevision?: string }) => {
  let failsLeft = input?.failSaves ?? 0;
  const saves: string[] = [];
  const operations: string[] = [];
  const states: Array<{ dirty: boolean; saving: boolean; saveError?: string }> = [];
  let loads = 0;
  let operation = 0;
  const controller = createFileEditController({
    binding,
    debounceMs: DEBOUNCE_MS,
    load: () => {
      loads += 1;
    },
    createOperationId: () => `operation-${++operation}`,
    onStateChange: (state) => states.push(state),
    save: async (value, origin) => {
      operations.push(origin.operationId);
      if (failsLeft > 0) {
        failsLeft -= 1;
        throw new Error("save failed");
      }
      saves.push(value);
      return input?.saveRevision ? { revision: input.saveRevision } : undefined;
    },
  });
  return { controller, operations, saves, states, loads: () => loads };
};

describe("file edit controller", () => {
  test("a change equal to the loaded content schedules no save", async () => {
    const { controller, saves } = createHarness();
    controller.setBaseline("loaded", "1");

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

  test("a refresh from the active save is self invalidation and never reloads", async () => {
    const { controller, saves, loads } = createHarness();
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    controller.flush();
    controller.handleRefreshEvent({
      resourceUri: binding.resourceUri,
      origin: { ...binding, operationId: "operation-1" },
    });
    expect(loads()).toBe(0);

    await tick();

    expect(saves).toEqual(["edited"]);
    expect(loads()).toBe(0);
  });

  test("an event for another resource never reloads", () => {
    const { controller, loads } = createHarness();
    controller.setBaseline("loaded");

    controller.handleRefreshEvent({ resourceUri: "dashboard-workbench://ticket/ticket-2", revision: "2" });

    expect(loads()).toBe(0);
  });

  test("duplicate clean external revisions reload once", () => {
    const { controller, loads } = createHarness();
    controller.setBaseline("loaded", "1");

    controller.handleRefreshEvent({ resourceUri: binding.resourceUri, revision: "2" });
    controller.handleRefreshEvent({ resourceUri: binding.resourceUri, revision: "2" });

    expect(loads()).toBe(1);
  });

  test("a newer external revision during save reloads after local state settles", async () => {
    const { controller, saves, loads } = createHarness({ saveRevision: "2" });
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    controller.flush();
    controller.handleRefreshEvent({ resourceUri: binding.resourceUri, revision: "3" });
    controller.handleRefreshEvent({ resourceUri: binding.resourceUri, revision: "3" });
    expect(loads()).toBe(0);
    await tick();

    expect(saves).toEqual(["edited"]);
    expect(loads()).toBe(1);
  });

  test("a deferred revision at the completed save revision does not reload", async () => {
    const { controller, loads } = createHarness({ saveRevision: "3" });
    controller.setBaseline("loaded", "1");

    controller.handleChange("edited");
    controller.flush();
    controller.handleRefreshEvent({ resourceUri: binding.resourceUri, revision: "3" });
    await tick();

    expect(loads()).toBe(0);
  });

  test("a generic external invalidation during save reloads after the save settles", async () => {
    const { controller, loads } = createHarness();
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    controller.flush();
    controller.handleRefreshEvent({});
    await tick();

    expect(loads()).toBe(1);
  });

  test("a load that settles after an edit cannot replace the draft", () => {
    const { controller } = createHarness();
    controller.setBaseline("loaded", "1");
    controller.handleRefreshEvent({ resourceUri: binding.resourceUri, revision: "2" });
    controller.handleChange("draft");

    expect(controller.acceptLoaded("external", "2")).toBe(false);
    expect(controller.getBaseline()).toBe("loaded");
    expect(controller.getState()).toMatchObject({ dirty: true });
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

  test("a failed save stays dirty and retries only when requested", async () => {
    const { controller, saves, states } = createHarness({ failSaves: 1 });
    controller.setBaseline("loaded");

    controller.handleChange("edited");
    await tick();
    expect(saves).toEqual([]);
    expect(states.at(-1)).toMatchObject({ dirty: true, saving: false, saveError: "save failed" });

    await tick();
    expect(saves).toEqual([]);

    controller.retry();
    await tick();

    expect(saves).toEqual(["edited"]);
  });

  test("each active save has one operation id and saves never overlap", async () => {
    let resolveFirst!: () => void;
    let active = 0;
    let maxActive = 0;
    const saves: string[] = [];
    let operation = 0;
    const controller = createFileEditController({
      binding,
      debounceMs: DEBOUNCE_MS,
      load: () => {},
      createOperationId: () => `operation-${++operation}`,
      save: async (value) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        saves.push(value);
        if (value === "first") await new Promise<void>((resolve) => (resolveFirst = resolve));
        active -= 1;
      },
    });
    controller.setBaseline("loaded");

    controller.handleChange("first");
    controller.flush();
    controller.handleChange("second");
    await tick();
    expect(saves).toEqual(["first"]);
    resolveFirst();
    await tick();

    expect(saves).toEqual(["first", "second"]);
    expect(maxActive).toBe(1);
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
    const previous = { content: "same", loadKey: "a", editorRevision: 3 };

    expect(nextLoadedRevision(previous, { content: "same" }, "a")).toBe(3);
  });

  test("bumps the revision when the content changed", () => {
    const previous = { content: "old", loadKey: "a", editorRevision: 3 };

    expect(nextLoadedRevision(previous, { content: "new" }, "a")).toBe(4);
  });

  test("restarts at one for a different load key", () => {
    const previous = { content: "same", loadKey: "a", editorRevision: 3 };

    expect(nextLoadedRevision(previous, { content: "same" }, "b")).toBe(1);
  });

  test("keeps the revision when the reload matches what the editor already shows", () => {
    const previous = { content: "loaded", loadKey: "a", editorRevision: 3 };

    expect(nextLoadedRevision(previous, { content: "saved draft" }, "a", "saved draft")).toBe(3);
  });

  test("bumps the revision when the reload differs from the editor value", () => {
    const previous = { content: "loaded", loadKey: "a", editorRevision: 3 };

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
