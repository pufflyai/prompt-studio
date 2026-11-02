import { expect, test } from "bun:test";
import { createFileRendererLoadKey, createNativeDocumentKey } from "./native-documents";

const input = {
  fileRendererId: "notes.editor",
  resource: {
    type: "note",
    id: "one",
    extensionId: "pstdio.notes",
    projectId: "project",
    metadata: { file: "body", range: { start: 1, end: 2 } },
  },
  pageParams: { live: true, range: "today" },
};

test("native document identity agrees across metadata and page-parameter ordering", () => {
  const reordered = {
    ...input,
    resource: { ...input.resource, metadata: { range: { end: 2, start: 1 }, file: "body" }, label: "Renamed" },
    pageParams: { range: "today", live: true },
  };
  expect(createFileRendererLoadKey(reordered)).toBe(createFileRendererLoadKey(input));
  expect(createNativeDocumentKey(reordered)).toBe(createNativeDocumentKey(input));
  expect(createNativeDocumentKey(input)).toMatch(/^[a-f0-9]{64}$/);
});

test("native document identity separates every input that selects loaded content", () => {
  const key = createNativeDocumentKey(input);
  const variants = [
    { ...input, fileRendererId: "reports.editor" },
    { ...input, resource: { ...input.resource, id: "two" } },
    { ...input, resource: { ...input.resource, type: "report" } },
    { ...input, resource: { ...input.resource, extensionId: "other.notes" } },
    { ...input, resource: { ...input.resource, projectId: "other" } },
    { ...input, resource: { ...input.resource, metadata: { file: "attachment" } } },
    { ...input, pageParams: { live: true, range: "yesterday" } },
  ];
  for (const variant of variants) expect(createNativeDocumentKey(variant)).not.toBe(key);
});

test("native documents also identify renderers without a bound resource", () => {
  expect(createNativeDocumentKey({ fileRendererId: "scratch", resource: undefined })).not.toBe(
    createNativeDocumentKey({ fileRendererId: "other", resource: undefined }),
  );
});

test("native document key ordering is independent of a device's locale", () => {
  const key = createFileRendererLoadKey({
    fileRendererId: "scratch",
    resource: undefined,
    pageParams: { ä: 3, a: 2, Z: 1 },
  });
  expect(key.endsWith('{"Z":1,"a":2,"ä":3}')).toBe(true);
});

test("an explicit renderer document key keeps drafts across unrelated metadata updates", () => {
  const target = { ...input, documentKey: "draft.md" };
  const key = createFileRendererLoadKey(target);
  expect(createFileRendererLoadKey({ ...target, resource: { ...input.resource, metadata: { count: 2 } } })).toBe(key);
  expect(createFileRendererLoadKey({ ...target, documentKey: "other.md" })).not.toBe(key);
  expect(createFileRendererLoadKey({ ...target, pageParams: { live: false } })).not.toBe(key);
  expect(createFileRendererLoadKey({ ...target, resource: { ...input.resource, projectId: "other" } })).not.toBe(key);
});
