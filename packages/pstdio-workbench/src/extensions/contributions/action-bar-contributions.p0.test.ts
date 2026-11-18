import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { registerWorkbenchExtensionContributions } from "../host/workbench-extension-host";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

test("action bar contributions stay lazy and release their owned view on disposal", () => {
  const workbench = createWorkbench();
  let reads = 0;
  const register = () =>
    registerWorkbenchExtensionContributions({
      projectId: "project",
      workbench,
      executeCommand() {
        reads++;
        return { items: [] };
      },
      metadata: {
        ...emptyWorkbenchExtensionMetadata,
        extensions: [{ id: "example.editor", name: "editor", displayName: "Editor", sourcePath: "/editor" }],
        views: [
          {
            id: "example.editor.view.tools",
            localId: "tools",
            extensionId: "example.editor",
            title: "Tools",
            body: { kind: "actionBar", queryHandlerId: "example.editor.view.tools.actionBar.query" },
          },
        ],
      },
    });
  const first = register();
  expect(workbench.views.getView("example.editor.view.tools")).toBeDefined();
  expect(reads).toBe(0);
  first.dispose();
  expect(workbench.views.getView("example.editor.view.tools")).toBeUndefined();
  const second = register();
  expect(workbench.views.getView("example.editor.view.tools")).toBeDefined();
  second.dispose();
  expect(workbench.views.getView("example.editor.view.tools")).toBeUndefined();
});
