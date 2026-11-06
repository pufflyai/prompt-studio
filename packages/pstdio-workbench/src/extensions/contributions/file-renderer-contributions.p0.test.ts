import { expect, test } from "bun:test";
import { extensionFileRendererRecordSchema } from "pstdio-api-contracts";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionFileRenderers } from "./file-renderer-contributions";
import { metadata } from "./tree-renderer-contributions.fixture";

test("public file views retain manual saving and a stable selected-document identity", () => {
  const workbench = createWorkbench();
  const record = extensionFileRendererRecordSchema.parse({
    id: "example.files.view.editor",
    extensionId: "example.files",
    title: "Files",
    loadHandlerId: "load",
    saveHandlerId: "save",
    saveMode: "manual",
    document: { metadataKey: "path" },
  });
  const registration = registerWorkbenchExtensionFileRenderers({
    workbench,
    projectId: "project",
    metadata: { ...metadata, fileRenderers: [record] },
    executeCommand: async () => ({}),
  });
  const editor = getWorkbenchRenderers(workbench).getFileRenderer(record.id)!;
  expect(editor.saveMode).toBe("manual");
  const resource = { type: "workspace", id: "one", metadata: { path: "src/index.ts", name: "Before" } };
  const key = editor.documentKey?.(resource);
  expect(key).toBeDefined();
  expect(editor.documentKey?.({ ...resource, metadata: { ...resource.metadata, name: "After" } })).toBe(key);
  expect(editor.documentKey?.({ ...resource, metadata: { path: "src/other.ts" } })).not.toBe(key);
  expect(editor.documentKey?.({ ...resource, id: "two" })).not.toBe(key);
  registration.dispose();
  expect(getWorkbenchRenderers(workbench).getFileRenderer(record.id)).toBeUndefined();
});
