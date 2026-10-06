import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { createStartModule } from "./module";

const registerExtensionPage = (
  workbench: ReturnType<typeof createWorkbench>,
  input: { id: string; title: string; resourceKind?: string },
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
    modeId: "project",
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

    const tools = workbench.resources.listResources("").filter((entry) => entry.group === "Tools");

    expect(tools.map((entry) => entry.resource.label)).toEqual(["Scribble"]);
  });
});
