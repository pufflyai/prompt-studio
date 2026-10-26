import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("an empty Secondary card shares numbering with tabs and opens in its displayed panel", async () => {
  const core = createWorkbench();
  const opened: string[] = [];
  core.modes.registerMode({
    id: "project",
    activate() {},
    listAddablePanels: () => [{ panelId: "session", region: "secondary" }],
  });
  core.modes.setActiveMode("project");
  core.commands.registerCommand(
    { id: "new-session", label: "New session" },
    {
      execute: (_args, context) => {
        opened.push(context!.region!);
      },
    },
  );
  core.layout.registerWidget({
    id: "session",
    title: "New session tab",
    region: "secondary",
    rendererId: "test",
    openCommand: { commandId: "new-session" },
    closable: true,
  });
  core.layout.setRegionVisible("secondary", true);
  core.keyboard.registerEmptyPanel("secondary", () => ({ top: 100, left: 0 }));
  const target = core.keyboard.listNumberedTargets()[0]!;
  expect(target).toMatchObject({ kind: "new-tab", region: "secondary", number: 1, label: "New session tab" });
  core.keyboard.open();
  await core.keyboard.press("1");
  expect(opened).toEqual(["secondary"]);
  expect(core.keyboard.store.getState().message).toBe("");
});
