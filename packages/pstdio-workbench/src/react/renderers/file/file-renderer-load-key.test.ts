import { expect, test } from "bun:test";
import { createFileRendererLoadKey } from "./file-renderer-load-key";

test("file cache identity distinguishes resource owners and projects", () => {
  const resource = { type: "note", id: "one", extensionId: "notes", projectId: "one" };
  const key = (value: typeof resource) => createFileRendererLoadKey({ fileRendererId: "editor", resource: value });
  expect(key(resource)).not.toBe(key({ ...resource, projectId: "two" }));
  expect(key(resource)).not.toBe(key({ ...resource, extensionId: "other" }));
});
