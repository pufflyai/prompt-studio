import { describe, expect, test } from "bun:test";
import {
  buildTemplateDraftKey,
  clearTemplateDraft,
  isTemplateEditorEmpty,
  loadTemplateDraft,
  saveTemplateDraft,
} from "./template-editor-draft";

const createStorage = () => {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
};

describe("template-editor-draft", () => {
  test("buildTemplateDraftKey includes project and template names", () => {
    expect(buildTemplateDraftKey("project-1", "ticket")).toBe("template-draft:project-1:ticket");
  });

  test("saveTemplateDraft and loadTemplateDraft round trip content", () => {
    const storage = createStorage();

    saveTemplateDraft(storage, "project-1", "ticket", "# Updated template");

    expect(loadTemplateDraft(storage, "project-1", "ticket")).toBe("# Updated template");
  });

  test("clearTemplateDraft removes saved content", () => {
    const storage = createStorage();
    saveTemplateDraft(storage, "project-1", "ticket", "# Updated template");

    clearTemplateDraft(storage, "project-1", "ticket");

    expect(loadTemplateDraft(storage, "project-1", "ticket")).toBeNull();
  });

  test("isTemplateEditorEmpty returns true for blank content", () => {
    expect(isTemplateEditorEmpty("")).toBe(true);
    expect(isTemplateEditorEmpty("   \n\t")).toBe(true);
    expect(isTemplateEditorEmpty("# Template")).toBe(false);
  });
});
