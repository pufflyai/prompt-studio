import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const pageRef = (id: string) => ({ kind: "page" as const, extensionId: "test", id });

const setup = (presentation: "page" | "tabs") => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["editor", "properties", "tool"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.viewMenus.registerViewMenu({ id: "properties-menu", ownerViewId: "editor", viewId: "properties", side: "right" });
  w.pages.registerPage({
    id: "record",
    ref: pageRef("record"),
    path: "record",
    modeId: "project",
    main: { kind: "view", presentation, view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  w.pageLocations.setProject("project-1");
  w.pageLocations.navigate({ kind: "page", page: pageRef("record") });
  return w;
};

const rightMenus = (w: ReturnType<typeof createWorkbench>) =>
  w.layout.getLayout().regions["main-right-menu"].widgets.map((placement) => placement.viewId);

test.each(["page", "tabs"] as const)("Main view menus stay with their owner, presentation=%s", (presentation) => {
  const w = setup(presentation);
  expect(rightMenus(w)).toEqual(["properties"]);
  // Unrelated layout changes reconcile menu ownership without orphaning page-content menus.
  w.layout.reconcilePanelMenus();
  expect(rightMenus(w)).toEqual(["properties"]);
});
