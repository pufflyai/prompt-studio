import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { contributionRefId, workbenchModes } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../core";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";
import type { WorkbenchExtensionRefreshEvent } from "./workbench-extension-refresh";

const projectId = "project";
const notesChanged = { id: "acme.notes.event.changed", projectId };
const notesCommand = "acme.notes.command.create";
const noteView = {
  id: "acme.notes.view.notes",
  extensionId: "acme.notes",
  localId: "notes",
  title: "Notes",
  body: { kind: "tree", bodyHandlerId: "acme.notes.tree.body", refreshEventIds: [notesChanged.id] },
} satisfies WorkbenchExtensionMetadata["views"][number];
const fileView = {
  id: "acme.files.view.files",
  extensionId: "acme.files",
  localId: "files",
  title: "Files",
  body: { kind: "tree", bodyHandlerId: "acme.files.tree.body", refreshEventIds: ["acme.files.event.changed"] },
} satisfies WorkbenchExtensionMetadata["views"][number];

for (const scenario of [
  { title: "through its change event", events: [notesChanged], publish: true },
  { title: "when the command has no refresh event", events: [], publish: true },
  { title: "when the host does not publish command events", events: [notesChanged], publish: false },
]) {
  test(`a sidebar action refreshes only its contribution ${scenario.title}`, async () => {
    const workbench = createWorkbench();
    const owner = { ...workbenchModes.project, id: contributionRefId(workbenchModes.project) };
    const context = { projectId };
    const queries: string[] = [];
    let notes = 0;
    const listeners = new Set<(event: WorkbenchExtensionRefreshEvent) => void>();
    const readSidebar = () => workbench.navigationTrees.getSections(owner, "content", context);
    const registration = registerWorkbenchExtensionContributions({
      metadata: {
        extensions: [],
        commands: [],
        menuContributions: [],
        commandPaletteContributions: [],
        modes: [],
        pages: [],
        views: [noteView, fileView],
        viewMenus: [],
        placements: [],
        resourceKinds: [],
        navigationItems: [],
        navigationTrees: [noteView, fileView].map((view) => ({
          id: `${view.extensionId}.navigation-tree.list`,
          extensionId: view.extensionId,
          owner: workbenchModes.project,
          view: { kind: "view", id: view.localId, extensionId: view.extensionId },
          slot: "content",
          resourceScope: "project",
        })),
        statusBarItems: [],
        settingsPanels: [],
        diagnostics: [],
      },
      workbench,
      projectId,
      publishesCommandRefreshEvents: scenario.publish,
      subscribeRefreshEvents: (listener) => {
        listeners.add(listener);
        return { dispose: () => listeners.delete(listener) };
      },
      executeCommand: async (id) => {
        if (id === notesCommand) {
          notes++;
          const { events } = scenario;
          if (scenario.publish && events.length) {
            for (const event of events) for (const listener of listeners) listener(event);
            // The sidebar can read while the tree action is still handling its command result.
            await readSidebar();
          }
          return { commandId: id, extensionId: noteView.extensionId, outcome: { ok: true, status: "success" }, events };
        }
        queries.push(id);
        if (id === noteView.body.bodyHandlerId) {
          return [
            {
              id: "notes",
              nodes: [
                {
                  id: "notes",
                  label: `Notes (${notes})`,
                  actions: [{ id: "create", label: "New note", command: { kind: "command", id: "create" } }],
                },
              ],
            },
          ];
        }
        return [{ id: "files", nodes: [{ id: "files", label: "Project files" }] }];
      },
    });
    try {
      const before = await readSidebar();
      const nodes = before.flatMap((section) => section.nodes);
      const create = nodes.find((node) => node.label === "Notes (0)")?.actions?.[0]?.run;
      expect(create).toBeDefined();
      await create?.();
      const after = await readSidebar();
      expect(
        after
          .flatMap((section) => section.nodes)
          .map((node) => node.label)
          .sort(),
      ).toEqual(["Notes (1)", "Project files"]);
      expect(queries.filter((id) => id === noteView.body.bodyHandlerId)).toHaveLength(2);
      expect(queries.filter((id) => id === fileView.body.bodyHandlerId)).toHaveLength(1);
    } finally {
      registration.dispose();
      await workbench.dispose();
    }
  });
}
