import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { getWorkbenchRenderers } from "../../workbench-renderers";

test("a native terminal view registers and disposes its host renderer", () => {
  const workbench = createWorkbench();
  const render = () => "host terminal";
  const registration = workbench.views.registerView({
    id: "example.console.view.shell",
    title: "Shell",
    body: { kind: "terminal", render },
  });
  expect(getWorkbenchRenderers(workbench).getRenderer("example.console.view.shell")?.render).toBe(render);
  registration.dispose();
  expect(getWorkbenchRenderers(workbench).getRenderer("example.console.view.shell")).toBeUndefined();
});

test("a native view owns its renderer without creating layout state", () => {
  const workbench = createWorkbench();
  const registration = workbench.views.registerView({
    id: "project.navigation",
    title: "Project",
    body: {
      kind: "tree",
      getBody: () => [],
      getChildren: () => [],
    },
  });

  expect(workbench.views.getView("project.navigation")).toBeDefined();
  expect(getWorkbenchRenderers(workbench).getTreeRenderer("project.navigation")).toBeDefined();
  expect(workbench.layout.getWidget("project.navigation")).toBeUndefined();

  registration.dispose();

  expect(workbench.views.getView("project.navigation")).toBeUndefined();
  expect(getWorkbenchRenderers(workbench).getTreeRenderer("project.navigation")).toBeUndefined();
  expect(workbench.layout.getWidget("project.navigation")).toBeUndefined();
});
