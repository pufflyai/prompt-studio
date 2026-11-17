import { expect, test } from "bun:test";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { createWorkbench } from "../../workbench-core";

test.each([
  "shell",
  "mode",
] as const)("%s placement observation retires a callback already queued in a batch", async (kind) => {
  const core = createWorkbench();
  const registry = kind === "shell" ? core.shellPlacements : core.modePlacements;
  core.views.registerView({ id: "notes", title: "Notes", body: { kind: "react", render: () => null } });
  let notices = 0;
  const subscription = registry.onDidChange(() => notices++);
  batchWorkbenchChanges(() => {
    const declaration = {
      id: "notes",
      region: "secondary" as const,
      item: { kind: "view" as const, presence: "closed" as const, view: { kind: "view" as const, id: "notes" } },
    };
    if (kind === "shell") core.shellPlacements.registerPlacement(declaration);
    else
      core.modePlacements.registerPlacement({
        ...declaration,
        modeId: "mode",
        ref: { kind: "placement", extensionId: "test", id: "notes" },
      });
    subscription.dispose();
  });
  expect(notices).toBe(0);
  await core.dispose();
});

test.each([
  "shell",
  "mode",
] as const)("%s placement registration closes safely when publication retires its owner", async (kind) => {
  const core = createWorkbench();
  core.views.registerView({ id: "notes", title: "Notes", body: { kind: "react", render: () => null } });
  const registry = kind === "shell" ? core.shellPlacements : core.modePlacements;
  registry.onDidChange(() => registry.dispose?.());
  const declaration = {
    id: "notes",
    region: "secondary" as const,
    item: { kind: "view" as const, presence: "closed" as const, view: { kind: "view" as const, id: "notes" } },
  };
  if (kind === "shell") core.shellPlacements.registerPlacement(declaration);
  else
    core.modePlacements.registerPlacement({
      ...declaration,
      modeId: "mode",
      ref: { kind: "placement", extensionId: "test", id: "notes" },
    });
  expect(registry.listPlacements()).toEqual([]);
  expect(core.layout.listWidgets()).toEqual([]);
  await core.dispose();
});
