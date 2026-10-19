import { expect, test } from "bun:test";
import { createFileRendererDocumentKey, createFileRendererLoadKey } from "./file-renderer-load-key";

test("document identity includes renderer, resource owner, metadata and page parameters", async () => {
  const input = {
    fileRendererId: "notes.editor",
    resource: { extensionId: "notes", projectId: "one", type: "note", id: "one", metadata: { b: 2, a: 1 } },
    pageParams: { live: true, range: "today" },
  };
  const key = await createFileRendererDocumentKey(input);
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(key).toBe(
    await createFileRendererDocumentKey({
      ...input,
      resource: { ...input.resource, metadata: { a: 1, b: 2 } },
      pageParams: { range: "today", live: true },
    }),
  );
  for (const changed of [
    { ...input, fileRendererId: "other" },
    { ...input, resource: { ...input.resource, extensionId: "other" } },
    { ...input, resource: { ...input.resource, projectId: "other" } },
    { ...input, resource: { ...input.resource, metadata: { a: 3 } } },
    { ...input, pageParams: { range: "yesterday" } },
  ])
    expect(await createFileRendererDocumentKey(changed)).not.toBe(key);
  expect(createFileRendererLoadKey(input)).toBe(
    createFileRendererLoadKey({ ...input, resource: { ...input.resource, label: "Renamed", icon: "note" } }),
  );
});

test("document metadata key order is independent of Unicode collation", async () => {
  const input = { fileRendererId: "notes.editor", resource: { type: "note", id: "one" } };
  const first = await createFileRendererDocumentKey({
    ...input,
    resource: { ...input.resource, metadata: { é: "one", "e\u0301": "two" } },
  });
  expect(first).toBe(
    await createFileRendererDocumentKey({
      ...input,
      resource: { ...input.resource, metadata: { "e\u0301": "two", é: "one" } },
    }),
  );
});
