import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { createStartModule } from "./module";

const registerExtensionPage = (
  workbench: ReturnType<typeof createWorkbench>,
  input: { id: string; title: string; resourceKind?: string; modeId?: string; modeIds?: readonly string[] },
) => {
  workbench.views.registerView({
    id: `lab.view.${input.id}`,
    title: input.title,
    body: { kind: "react", render: () => null },
  });
  workbench.pages.registerPage({
    id: `lab.page.${input.id}`,
    ref: { kind: "page", extensionId: "lab", id: input.id },
    title: input.title,
    icon: "pencil",
    path: input.id,
    modeId: input.modeId ?? "project",
    ...(input.modeIds ? { modeIds: input.modeIds } : {}),
    ...(input.resourceKind
      ? {
          parentId: "lab.page.scribble",
          resource: { kinds: [{ kind: "resource-kind", extensionId: "lab", id: input.resourceKind }] },
        }
      : {}),
    main: { kind: "view", view: { kind: "view", id: `lab.view.${input.id}` }, cardinality: "one" },
    slots: [],
  });
};

describe("tool resources", () => {
  test("lists the pages that extensions open as tools", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.registerModule(createStartModule());
    registerExtensionPage(workbench, { id: "scribble", title: "Scribble" });
    registerExtensionPage(workbench, { id: "note", title: "Note", resourceKind: "note" });
    workbench.pageLocations.switchProject("project-1");

    const tools = workbench.resources.listResources("").filter((entry) => entry.group === "Tools");

    expect(tools.map((entry) => entry.resource.label)).toEqual(["Scribble"]);
  });

  test("filters tools by the active mode and keeps shared pages available", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.modes.registerMode({
      id: "boombox",
      basePage: { kind: "page", extensionId: "lab", id: "overview" },
      activate: () => undefined,
    });
    workbench.registerModule(createStartModule());
    registerExtensionPage(workbench, { id: "scribble", title: "Scribble" });
    registerExtensionPage(workbench, { id: "overview", title: "Overview", modeIds: ["project", "boombox"] });
    registerExtensionPage(workbench, { id: "music", title: "Music", modeId: "boombox", modeIds: ["boombox"] });
    workbench.pageLocations.switchProject("project-1");
    const tools = () =>
      workbench.resources
        .listResources("")
        .filter((entry) => entry.group === "Tools")
        .map((entry) => entry.resource.label);
    expect(tools()).toEqual(["Overview", "Scribble"]);
    workbench.modes.setActiveMode("boombox");
    expect(tools()).toEqual(["Music", "Overview"]);
  });
});
