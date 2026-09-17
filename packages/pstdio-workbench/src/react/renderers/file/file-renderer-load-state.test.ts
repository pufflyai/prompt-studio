import { describe, expect, test } from "bun:test";
import { createFileEditController } from "./file-renderer-edit-state";
import { type LoadedFile, prepareFileRendererLoad } from "./file-renderer-load-state";

const createHarness = (failSave = false) => {
  let loaded: LoadedFile | null = null;
  let reloads = 0;
  const controller = createFileEditController({
    binding: { rendererId: "ticket", instanceId: "editor" },
    debounceMs: 600,
    load: () => {
      reloads += 1;
    },
    save: async () => {
      if (failSave) {
        failSave = false;
        throw new Error("save failed");
      }
    },
  });
  const load = (content: string) => {
    const update = prepareFileRendererLoad({ content }, "ticket:1", controller);
    if (update) loaded = update(loaded);
    return loaded;
  };
  return {
    controller,
    load,
    reloads: () => reloads,
    reopen: () => {
      loaded = { content: "cached body", loadKey: "ticket:1", editorRevision: 1 };
      controller.setBaseline(loaded.content);
    },
  };
};

// These exercise the same acceptance and revision sequence as the view.
describe("file renderer content loads", () => {
  test("reopening a cached document replaces its stale editor content", () => {
    const { reopen, load } = createHarness();
    reopen();
    expect(load("external body")).toMatchObject({ content: "external body", editorRevision: 2 });
  });

  test("an external refresh replaces the open editor content", () => {
    const { load } = createHarness();
    expect(load("original body")?.editorRevision).toBe(1);
    expect(load("external body")?.editorRevision).toBe(2);
    expect(load("external body")?.editorRevision).toBe(2);
  });

  test("a reload after the editor's own save keeps its revision", async () => {
    const { controller, load } = createHarness();
    load("original body");
    controller.handleChange("saved body");
    controller.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.getBaseline()).toBe("saved body");
    expect(load("saved body")).toMatchObject({ content: "saved body", editorRevision: 1 });
  });

  test("a failed save protects local edits and defers reloads", async () => {
    const { controller, load, reloads } = createHarness(true);
    load("original body");
    controller.handleChange("local draft");
    controller.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.getState().saveError).toBe("save failed");
    expect(load("external body")).toMatchObject({ content: "original body", editorRevision: 1 });
    expect(controller.getBaseline()).toBe("original body");
    expect(reloads()).toBe(0);
    controller.retry();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reloads()).toBe(1);
    expect(load("external body")).toMatchObject({ content: "external body", editorRevision: 2 });
  });
});
