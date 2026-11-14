import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "@pstdio/workbench";
import type { ExtensionKeybindingRecord } from "pstdio-api-contracts";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { publishResourceRemoval } from "@/shared/extensions/resource-removal-feed";
import { createExtensionsModule } from "./module";
import {
  emptyAppearance,
  flushMicrotasks,
  metadata,
  metadataWithResourceExtension,
  response,
} from "./module-test-fixtures";

for (const addedTool of ["healthy", "broken"] as const) {
  test(`an unrelated ${addedTool} tool addition preserves an open viewer's command authority`, async () => {
    const workbench = createWorkbench();
    const projectId = "viewer-refresh";
    const extensionId = "acme.issue-tracker";
    const commandId = `${extensionId}.command.switch`;
    const panel = { kind: "placement" as const, extensionId, id: "details" };
    const initial: WorkbenchExtensionMetadata = {
      ...metadataWithResourceExtension,
      commands: [...metadataWithResourceExtension.commands, { id: commandId, extensionId, title: "Switch issue" }],
      placements: [
        {
          id: `${extensionId}.placement.details`,
          localId: "details",
          extensionId,
          mode: { kind: "mode", extensionId: "pstdio", id: "project" },
          region: "side",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", extensionId, id: "issue" }],
              view: { kind: "view", extensionId, id: "issueFiles" },
              cardinality: "many",
            },
          },
        },
      ],
    };
    let current = initial;
    const calls: string[] = [];
    workbench.modes.registerMode({ id: "project", activate() {} });
    workbench.pageLocations.setProject(projectId);
    selectDashboardProject(workbench, { id: projectId, name: "Viewer refresh" });
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: async () => emptyAppearance,
        loadMetadata: async () => current,
        executeCommand: async (_projectId, id) => {
          calls.push(id);
          return { ...response, commandId: id, extensionId };
        },
      }),
    );
    const writer = getWriter("extension_instances");
    try {
      await flushMicrotasks();
      await flushMicrotasks();
      expect(
        workbench.pageLocations.navigate({
          kind: "page",
          page: { kind: "page", extensionId: "pstdio.extension-lab", id: "labPage" },
        }).ok,
      ).toBe(true);
      workbench.modePlacements.openPlacement({
        panel,
        resource: { type: "issue", id: "original", extensionId, projectId },
        open: "pin",
      });
      const before = workbench.layout.getActivePanel("side")!;
      expect(before.resource?.id).toBe("original");
      const captured = workbench.viewers.captureContext(before.placementIdentity);
      expect(captured.isViewerCurrent?.()).toBe(true);
      const addedView = {
        ...initial.views[0],
        id: "acme.other.view.other",
        localId: "other",
        extensionId: "acme.other",
      };
      current = {
        ...initial,
        extensions: [...initial.extensions, { id: "acme.other", name: "other", displayName: "Other", sourcePath: "" }],
        views: [...initial.views, addedView, ...(addedTool === "broken" ? [addedView] : [])],
      };
      writer?.upsert({ id: projectId });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(Boolean(workbench.views.getView("acme.other.view.other"))).toBe(addedTool === "healthy");
      expect(workbench.layout.getActivePanel("side")).toMatchObject({
        placementIdentity: before.placementIdentity,
        resource: before.resource,
      });
      expect(captured.isViewerCurrent?.()).toBe(true);
      await workbench.commands.executeCommand(commandId, {}, captured);
      expect(calls.filter((id) => id === commandId)).toHaveLength(1);
      const removalVersion = workbench.resources.getRemovalVersion();
      publishResourceRemoval({ type: "issue", id: "other", extensionId, projectId });
      expect(workbench.resources.getRemovalVersion()).toBe(removalVersion + 1);

      current = {
        ...initial,
        commands: initial.commands.map((command) =>
          command.id === commandId ? { ...command, title: "Changed switch definition" } : command,
        ),
      };
      writer?.upsert({ id: projectId, revision: 2 });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(captured.isViewerCurrent?.()).toBe(false);
    } finally {
      extensions.dispose();
      writer?.remove(projectId);
      await workbench.dispose();
    }
  });
}

test("an added tool keeps the catalog's shared setting winner", async () => {
  const workbench = createWorkbench();
  const projectId = "added-settings-owner";
  const key = "shared-setting-fixture";
  let current: WorkbenchExtensionMetadata = {
    ...metadata,
    settingsDefinitions: [
      { extensionId: metadata.extensions[0].id, key, type: "string", scope: "global", default: "first" },
    ],
  };
  selectDashboardProject(workbench, { id: projectId, name: "Shared setting owners" });
  const extensions = workbench.registerModule(
    createExtensionsModule({ loadAppearance: async () => emptyAppearance, loadMetadata: async () => current }),
  );
  const writer = getWriter("extension_instances");
  try {
    await flushMicrotasks();
    await flushMicrotasks();
    expect(workbench.preferences.getValue(key)).toBe("first");
    current = {
      ...current,
      extensions: [...current.extensions, { id: "acme.other", name: "other", displayName: "Other", sourcePath: "" }],
      settingsDefinitions: [
        ...current.settingsDefinitions!,
        { extensionId: "acme.other", key, type: "string", scope: "global", default: "last" },
      ],
    };
    writer?.upsert({ id: projectId });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(workbench.preferences.getValue(key)).toBe("last");
  } finally {
    extensions.dispose();
    writer?.remove(projectId);
    await workbench.dispose();
  }
});

test("an added tool keeps the catalog's shortcut precedence", async () => {
  const workbench = createWorkbench();
  const projectId = "added-shortcut-owner";
  const installedId = metadata.extensions[0].id;
  const addedId = "acme.other";
  const binding = (extensionId: string, id: string) =>
    ({
      id: `${extensionId}.keybinding.${id}`,
      extensionId,
      action: { kind: "command", target: { command: { kind: "command", extensionId, id } } },
      key: "mod+k",
      canonicalChord: "Mod+K",
      parsed: { key: "K", ctrl: false, shift: false, alt: false, meta: true, modifiers: ["Meta"] },
      allowInInputs: true,
    }) satisfies ExtensionKeybindingRecord;
  const installedCommand = `${installedId}.command.first`;
  const addedCommand = `${addedId}.command.second`;
  let current: WorkbenchExtensionMetadata = {
    ...metadata,
    commands: [...metadata.commands, { id: installedCommand, extensionId: installedId, title: "First" }],
    keybindings: [binding(installedId, "first")],
  };
  selectDashboardProject(workbench, { id: projectId, name: "Shortcut precedence" });
  const extensions = workbench.registerModule(
    createExtensionsModule({ loadAppearance: async () => emptyAppearance, loadMetadata: async () => current }),
  );
  const writer = getWriter("extension_instances");
  try {
    await flushMicrotasks();
    await flushMicrotasks();
    current = {
      ...current,
      extensions: [...current.extensions, { id: addedId, name: "other", displayName: "Other", sourcePath: "" }],
      commands: [...current.commands, { id: addedCommand, extensionId: addedId, title: "Second" }],
      keybindings: [binding(addedId, "second"), ...(current.keybindings ?? [])],
    };
    writer?.upsert({ id: projectId });
    await flushMicrotasks();
    await flushMicrotasks();
    const choices = workbench.keybindings
      .listActiveKeybindings()
      .filter(
        (entry) => entry.action.kind === "command" && [installedCommand, addedCommand].includes(entry.action.commandId),
      );
    expect(choices.flatMap((entry) => (entry.action.kind === "command" ? [entry.action.commandId] : []))).toEqual([
      addedCommand,
      installedCommand,
    ]);
  } finally {
    extensions.dispose();
    writer?.remove(projectId);
    await workbench.dispose();
  }
});
