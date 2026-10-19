import { expect, test } from "bun:test";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { createWorkbench } from "../../workbench-core";
import type { WorkbenchLayout } from "../layout/layout-types";

const panel = { kind: "placement", extensionId: "test", id: "files" } as const;
const page = { kind: "page", extensionId: "test", id: "notes" } as const;

test("restores mode bindings registered after batched page replay", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const create = () => {
    const w = createWorkbench({
      layoutPersistence: {
        getLayout: (scope) => saved.get(scope),
        setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
      },
    });
    w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
    w.pageLocations.setProject("project");
    return w;
  };
  const registerPage = (w: ReturnType<typeof create>) => {
    w.modes.registerMode({ id: "notes", activate() {} });
    w.pages.registerPage({
      id: "notes",
      ref: page,
      path: "notes",
      modeId: "notes",
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
      slots: [],
    });
  };
  const registerPanel = (w: ReturnType<typeof create>) =>
    w.modePlacements.registerPlacement({
      id: "notes.files",
      ref: panel,
      modeId: "notes",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "file" }],
          view: { kind: "view", id: "editor" },
          cardinality: "many",
        },
      },
    });
  const first = create();
  registerPage(first);
  registerPanel(first);
  await first.navigation.openTarget({ kind: "page", page });
  await first.navigation.openTarget({ kind: "panel", panel, resource: { type: "file", id: "saved" }, open: "pin" });

  const restored = create();
  const unsubscribe = restored.modes.store.subscribe(() => {
    if (restored.modes.getMode("notes") && !restored.modePlacements.getPlacement(panel)) registerPanel(restored);
  });
  batchWorkbenchChanges(() => {
    registerPage(restored);
    expect(restored.pageLocations.navigate({ kind: "page", page }).ok).toBe(true);
  });
  expect(restored.layout.listPanelInstances("side")).toEqual([
    expect.objectContaining({ resource: { type: "file", id: "saved" }, tabRetention: "persistent" }),
  ]);
  await restored.navigation.openTarget({ kind: "page", page });
  expect(restored.layout.listPanelInstances("side")[0].resource?.id).toBe("saved");
  unsubscribe();
});
