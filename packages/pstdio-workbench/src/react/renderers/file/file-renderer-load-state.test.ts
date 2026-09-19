import { describe, expect, test } from "bun:test";
import { createFileEditController } from "./file-renderer-edit-state";
import {
  acceptFileRendererLoad,
  type LoadedFile,
  readCachedFileContent,
  storeCachedFileContent,
} from "./file-renderer-load-state";

let documents = 0;

// Runs the sequence the renderer view runs: the view mounts the cached document,
// the controller asks for a load, and the updater returned by the load becomes
// the new React state. The editor is uncontrolled, so it only shows the new
// content when `editorRevision` changes.
const createHarness = (input?: { failSaves?: number }) => {
  let failsLeft = input?.failSaves ?? 0;
  let revision = 0;
  let stored = { content: "original body", revision: "0" };
  let loaded: LoadedFile | null = null;
  let loads = 0;
  const loadKey = `planner.ticketContent:ticket-${++documents}`;
  const applyLoad = (key = loadKey) => {
    const update = acceptFileRendererLoad(stored, key, controller);
    if (update) loaded = update(loaded);
  };
  const controller = createFileEditController({
    binding: { rendererId: "planner.ticketContent", instanceId: "planner.ticketEditor:1" },
    debounceMs: 600,
    load: () => {
      loads += 1;
      applyLoad();
    },
    save: async (value) => {
      if (failsLeft > 0) {
        failsLeft -= 1;
        throw new Error("save failed");
      }
      revision += 1;
      stored = { content: value, revision: String(revision) };
      return { revision: stored.revision };
    },
  });
  // The view's mount: show the cached document at once, then reconcile it.
  const open = (key = loadKey) => {
    const cached = readCachedFileContent(key);
    loaded = cached ? { ...cached, editorRevision: 1, loadKey: key } : null;
    if (cached) controller.setBaseline(cached.content, cached.revision);
    applyLoad(key);
    return loaded;
  };
  const writeOutsideTheEditor = (content: string) => {
    revision += 1;
    stored = { content, revision: String(revision) };
    return stored.revision;
  };
  return { controller, loaded: () => loaded, loads: () => loads, open, writeOutsideTheEditor };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("file renderer content loads", () => {
  test("reopening a document changed outside the editor shows the new content", () => {
    const { open, writeOutsideTheEditor } = createHarness();
    open();

    writeOutsideTheEditor("external body");

    expect(open()).toMatchObject({ content: "external body", editorRevision: 2 });
  });

  test("a change while the document is open repaints the editor", () => {
    const { controller, loaded, open, writeOutsideTheEditor } = createHarness();
    open();

    const revision = writeOutsideTheEditor("external body");
    controller.handleRefreshEvent({ revision });

    expect(loaded()).toMatchObject({ content: "external body", editorRevision: 2 });
  });

  test("a reload that returns the open document keeps the editor mounted", () => {
    const { controller, loaded, open } = createHarness();
    open();

    controller.handleRefreshEvent({});

    expect(loaded()).toMatchObject({ content: "original body", editorRevision: 1 });
  });

  test("a reload after the editor's own save keeps the editor mounted", async () => {
    const { controller, loaded, open } = createHarness();
    open();

    controller.handleChange("saved body");
    controller.flush();
    await settle();
    controller.handleRefreshEvent({});

    expect(controller.getBaseline()).toBe("saved body");
    expect(loaded()).toMatchObject({ content: "saved body", editorRevision: 1 });
  });

  test("a failed save keeps local edits until the retry releases the reload", async () => {
    const { controller, loaded, loads, open, writeOutsideTheEditor } = createHarness({ failSaves: 1 });
    open();

    controller.handleChange("local draft");
    controller.flush();
    await settle();
    expect(controller.getState().saveError).toBe("save failed");

    writeOutsideTheEditor("external body");
    controller.handleRefreshEvent({});
    expect(loads()).toBe(0);
    expect(loaded()).toMatchObject({ content: "original body", editorRevision: 1 });

    controller.retry();
    await settle();

    // The retry wins the write, so the released reload returns the draft the
    // editor already shows and leaves it mounted.
    expect(loads()).toBe(1);
    expect(loaded()).toMatchObject({ content: "local draft", editorRevision: 1 });
  });

  test("another document starts its own editor revision", () => {
    const { open } = createHarness();
    open();

    expect(open("planner.ticketContent:ticket-other")).toMatchObject({ editorRevision: 1 });
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
