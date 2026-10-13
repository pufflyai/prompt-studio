import { expect, test } from "bun:test";
import { workbenchExtensionViewRecordSchema } from "pstdio-api-contracts";
import { viewDeclarationSchema } from "./view-declaration";

test.each([
  "per-resource",
  "multiple",
  undefined,
])("views accept and transport instance policy %s", (instancePolicy) => {
  const body = { kind: "file", load: () => ({}) };
  const view = {
    id: "editor",
    ref: { kind: "view", id: "editor" },
    title: "Editor",
    instancePolicy,
    body,
  };
  expect(viewDeclarationSchema.parse(view).instancePolicy).toBe(instancePolicy);
  expect(
    workbenchExtensionViewRecordSchema.parse({
      id: "example.view.editor",
      localId: "editor",
      extensionId: "example",
      title: "Editor",
      instancePolicy,
      body: { kind: "file", loadHandlerId: "load" },
    }).instancePolicy,
  ).toBe(instancePolicy);
});
