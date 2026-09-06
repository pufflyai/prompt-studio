import { expect, test } from "bun:test";
import { workbenchExtensionPageRecordSchema } from "./page-metadata";

const view = { extensionId: "example", kind: "view", id: "content" } as const;
const resource = { kinds: [{ extensionId: "example", kind: "resource-kind" as const, id: "document" }] };
const page = (main: object) => ({
  id: "example.page.document",
  localId: "document",
  extensionId: "example",
  title: "Document",
  path: "document",
  mode: { extensionId: "pstdio", kind: "mode", id: "project" },
  parent: { extensionId: "pstdio", kind: "page", id: "start" },
  resource,
  main,
  slots: [],
});

test.each([
  { kind: "view", view, cardinality: "many" },
  { kind: "panels", empty: view },
])("preserves routed resource context with Main presentation %j", (main) => {
  const parsed = workbenchExtensionPageRecordSchema.parse(page(main));
  expect(parsed.resource).toEqual(resource);
  expect(parsed.main).toEqual(main);
});

test.each([
  [{ kind: "view", cardinality: "one" }, "view"],
  [{ kind: "view", view, cardinality: "several" }, "cardinality"],
  [{ kind: "panels" }, "empty"],
])("reports missing or invalid Main content %j", (main, field) => {
  const result = workbenchExtensionPageRecordSchema.safeParse(page(main));
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues[0]?.path).toEqual(["main", field]);
});
