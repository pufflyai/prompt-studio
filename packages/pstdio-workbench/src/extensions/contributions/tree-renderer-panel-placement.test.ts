import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";

const metadata = {
  extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "/extensions/lab" }],
  commands: [
    { id: "lab.files.body", extensionId: "pstdio.lab", title: "List files" },
    { id: "lab.files.children", extensionId: "pstdio.lab", title: "List children" },
    { id: "lab.files.footer", extensionId: "pstdio.lab", title: "List footer" },
    { id: "lab.files.open", extensionId: "pstdio.lab", title: "Open file" },
    { id: "lab.files.delete", extensionId: "pstdio.lab", title: "Delete file" },
  ],
  diagnostics: [],
  menuContributions: [],
  modes: [],
  navigation: [],
  routes: [],
  settingsPanels: [],
  treeItems: [],
  kanbanRenderers: [],
  panels: [
    {
      id: "lab.ticketFiles",
      extensionId: "pstdio.lab",
      region: "main",
      title: "Files",
      closable: false,
      resourceKind: "ticket",
      renderer: { kind: "tree", id: "lab.files" },
    },
  ],
  treeRenderers: [
    {
      id: "lab.files",
      extensionId: "pstdio.lab",
      title: "Files",
      icon: "Files",
      bodyHandlerId: "lab.files.body",
      childrenHandlerId: "lab.files.children",
      footerHandlerId: "lab.files.footer",
      defaultExpandedSectionIds: ["files"],
    },
  ],
} satisfies WorkbenchExtensionMetadata;

const success = (commandId: string, value: unknown): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.lab",
  outcome: { ok: true, status: "success", value },
});

describe("registerWorkbenchExtensionTreeRenderers placement", () => {
  test("honors panel placement when registering and opening tree-backed panels", () => {
    const workbench = createWorkbenchCore();
    const placementMetadata = {
      ...metadata,
      panels: [
        {
          id: "lab.last",
          extensionId: "pstdio.lab",
          title: "Last",
          closable: false,
          region: "main",
          placement: "last",
          renderer: { kind: "tree", id: "lab.files" },
        },
        {
          id: "lab.default",
          extensionId: "pstdio.lab",
          title: "Default",
          closable: false,
          region: "main",
          renderer: { kind: "tree", id: "lab.files" },
        },
        {
          id: "lab.first",
          extensionId: "pstdio.lab",
          title: "First",
          closable: false,
          region: "main",
          placement: "first",
          renderer: { kind: "tree", id: "lab.files" },
        },
      ],
    } satisfies WorkbenchExtensionMetadata;

    registerWorkbenchExtensionTreeRenderers({
      executeCommand: async (commandId) => success(commandId, []),
      metadata: placementMetadata,
      projectId: "project-1",
      workbench,
    });

    expect(workbench.layout.listPanels().map((panel) => panel.id)).toEqual(["lab.first", "lab.default", "lab.last"]);

    workbench.layout.openPanel("lab.last", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.default", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.first", { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main").map((panel) => panel.panelId)).toEqual([
      "lab.first",
      "lab.default",
      "lab.last",
    ]);
  });
});
