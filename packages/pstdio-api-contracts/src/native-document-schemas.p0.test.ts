import { expect, test } from "bun:test";
import { nativeDocumentTargetSchema, nativeFileContentSchema } from "./native-document-schemas";

test("native targets cannot select a workspace outside the file view identity", () => {
  expect(
    nativeDocumentTargetSchema.safeParse({ fileRendererId: "notes.editor", workspaceId: "other-worktree" }).success,
  ).toBe(false);
});

test("native document requests identify a registered view and reject direct source paths", () => {
  const target = {
    fileRendererId: "example.notes.view.document",
    resource: { type: "note", id: "one" },
    pageParams: { sections: ["body"] },
  };
  expect(nativeDocumentTargetSchema.parse(target)).toEqual(target);
  expect(nativeDocumentTargetSchema.safeParse({ ...target, filePath: "/private/file.md" }).success).toBe(false);
  expect(nativeDocumentTargetSchema.safeParse({ ...target, sourcePath: "/private/file.md" }).success).toBe(false);
});

test("native file content preserves extension metadata while checking editor fields", () => {
  expect(nativeFileContentSchema.parse({ content: "", editable: true, metadata: { custom: true } })).toEqual({
    content: "",
    editable: true,
    metadata: { custom: true },
  });
  expect(nativeFileContentSchema.safeParse({ content: 42 }).success).toBe(false);
  expect(nativeFileContentSchema.safeParse({ textRenderer: "custom" }).success).toBe(false);
});
