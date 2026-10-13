import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("Main header policy follows its page and restores that owner's choice", async () => {
  const core = createWorkbench();
  const ref = (id: string) => ({ kind: "page" as const, extensionId: "test", id });
  core.modes.registerMode({ id: "mode", activate() {} });
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  for (const id of ["hidden", "visible"]) {
    core.pages.registerPage({
      id,
      ref: ref(id),
      path: id,
      modeId: "mode",
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
      regionSettings: { main: { showHeader: id === "visible" } },
      slots: [],
    });
  }
  core.pageLocations.setProject("project");
  await core.navigation.openTarget({ kind: "page", page: ref("hidden") });
  expect(core.shell.getPanelPolicy("main").showHeader).toBe(false);
  expect(
    core.shell.getPanelPolicy("main", { projectId: "project", modeId: "mode", pageId: "visible" }).showHeader,
  ).toBe(true);
  core.shell.setHeaderVisible("main", true);
  await core.navigation.openTarget({ kind: "page", page: ref("visible") });
  expect(core.shell.getPanelPolicy("main").showHeader).toBe(true);
  await core.navigation.openTarget({ kind: "page", page: ref("hidden") });
  expect(core.shell.getPanelPolicy("main").showHeader).toBe(true);
  await core.dispose();
});
test("destination mode activation reads its page header default without a source override", async () => {
  const core = createWorkbench();
  const ref = (id: string) => ({ kind: "page" as const, extensionId: "test", id });
  let destinationHeader: boolean | undefined;
  core.modes.registerMode({ id: "hidden", activate() {} });
  core.modes.registerMode({
    id: "visible",
    activate() {
      destinationHeader = core.shell.getPanelPolicy("main").showHeader;
    },
  });
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  for (const id of ["hidden", "visible"]) {
    core.pages.registerPage({
      id,
      ref: ref(id),
      path: id,
      modeId: id,
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
      ...(id === "hidden" ? { regionSettings: { main: { showHeader: false } } } : {}),
      slots: [],
    });
  }
  try {
    core.pageLocations.setProject("project");
    await core.navigation.openTarget({ kind: "page", page: ref("hidden") });
    await core.navigation.openTarget({ kind: "page", page: ref("visible") });
    expect(destinationHeader).toBe(true);
    expect(core.shell.getPanelPolicy("main").showHeader).toBe(true);
  } finally {
    await core.dispose();
  }
});
