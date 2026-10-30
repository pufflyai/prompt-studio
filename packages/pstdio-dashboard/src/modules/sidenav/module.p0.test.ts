import { expect, test } from "bun:test";
import { createDashboardWorkbench } from "../../workbench";

test("the sidenav Search row shows the command palette shortcut", async () => {
  const core = createDashboardWorkbench();
  const search = (
    await core.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" }, "header")
  )
    .flatMap((section) => section.nodes)
    .find((node) => node.id === "search");
  expect(search?.target).toBeDefined();
  expect(core.keyboard.hint(search!.target!)).toBe("Mod+P");
});
