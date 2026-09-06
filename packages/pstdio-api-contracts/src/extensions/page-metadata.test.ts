import { expect, test } from "bun:test";
import { workbenchExtensionPageRecordSchema } from "./page-metadata";

const view = { extensionId: "example", kind: "view", id: "content" };
const binding = {
  kind: { extensionId: "example", kind: "resource-kind", id: "document" },
  view,
  cardinality: "one",
};
const page = (content: object) => ({
  id: "example.page.document",
  localId: "document",
  extensionId: "example",
  title: "Document",
  path: "document",
  mode: { extensionId: "pstdio", kind: "mode", id: "project" },
  parent: { extensionId: "pstdio", kind: "page", id: "start" },
  slots: [{ id: "content", role: "primary", region: "main", ...content }],
});

test("a primary slot has exactly one source of content", () => {
  expect(workbenchExtensionPageRecordSchema.safeParse(page({ view })).success).toBe(true);
  expect(workbenchExtensionPageRecordSchema.safeParse(page({ binding })).success).toBe(true);
  expect(workbenchExtensionPageRecordSchema.safeParse(page({})).success).toBe(false);
  expect(workbenchExtensionPageRecordSchema.safeParse(page({ view, binding })).success).toBe(false);
});
