import { expect, test } from "bun:test";
import { createFileRendererLoadKey } from "./file-renderer-load-key";

test("file cache identity distinguishes resource owners and projects", () => {
  const resource = { type: "note", id: "one", extensionId: "notes", projectId: "one" };
  const key = (value: typeof resource) => createFileRendererLoadKey({ fileRendererId: "editor", resource: value });
  expect(key(resource)).not.toBe(key({ ...resource, projectId: "two" }));
  expect(key(resource)).not.toBe(key({ ...resource, extensionId: "other" }));
});

test("file reads for different page params have separate cache entries", () => {
  const input = { fileRendererId: "report", resource: { type: "report", id: "one" } };
  const key = createFileRendererLoadKey({ ...input, pageParams: { range: "now-6h", live: true } });
  expect(key).not.toBe(createFileRendererLoadKey({ ...input, pageParams: { range: "now-24h", live: true } }));
  expect(key).toBe(createFileRendererLoadKey({ ...input, pageParams: { live: true, range: "now-6h" } }));
});

test("a stable document key keeps drafts across unrelated metadata changes", () => {
  const resource = { type: "workspace", id: "one", projectId: "project", metadata: { count: 1 } };
  const key = (value: typeof resource, path: string) =>
    createFileRendererLoadKey({
      fileRendererId: "files",
      resource: value,
      documentKey: path,
    });
  expect(key(resource, "notes.txt")).toBe(key({ ...resource, metadata: { count: 2 } }, "notes.txt"));
  expect(key(resource, "notes.txt")).not.toBe(key(resource, "other.txt"));
  expect(key(resource, "notes.txt")).not.toBe(key({ ...resource, projectId: "other" }, "notes.txt"));
});
