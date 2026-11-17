import { expect, test } from "bun:test";
import { publishExtensionEventReset } from "@/shared/extensions/extension-webview-broadcast";
import { extensionId, openNoteWorkbench, projectId, settle } from "./extension-resource-sync.fixture";

test("scoped resets leave unrelated primary and background resource resolvers idle", async () => {
  const fixture = openNoteWorkbench((resource) => resource);
  const { workbench } = fixture;
  const panel = { kind: "placement", id: "notes", extensionId } as const;
  workbench.modePlacements.registerPlacement({
    id: "notes",
    ref: panel,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "note" }],
        view: { kind: "view", id: "note" },
        cardinality: "many",
      },
    },
  });
  fixture.open({ type: "note", id: "primary", extensionId, projectId });
  workbench.modePlacements.openPlacement({
    panel,
    resource: { type: "note", id: "background", extensionId, projectId },
    open: "pin",
  });
  await settle();
  const initial = fixture.resolved.length;
  expect(initial).toBe(2);
  try {
    publishExtensionEventReset({ projectId: "other-project", extensionId });
    publishExtensionEventReset({ projectId, extensionId: "marmalade", recordIds: ["presentation"] });
    await settle();
    expect(fixture.resolved).toHaveLength(initial);
    publishExtensionEventReset({ projectId, extensionId });
    await settle();
    expect(fixture.resolved).toHaveLength(initial + 2);
  } finally {
    fixture.dispose();
    await workbench.dispose();
  }
});
