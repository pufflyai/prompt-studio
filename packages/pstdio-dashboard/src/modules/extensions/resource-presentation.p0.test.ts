import { expect, test } from "bun:test";
import type { CommandExecutionResult } from "@pstdio/sdk/api";
import { createWorkbench, type ResourceRef } from "@pstdio/workbench";
import { publishExtensionEvent, publishExtensionEventReset } from "@/shared/extensions/extension-webview-broadcast";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { watchOpenExtensionResource } from "./extension-resource-sync";
import { settle } from "./extension-resource-sync.fixture";

test.each(["event", "reset"])("an extension updates its resource icons after %s", async (trigger) => {
  const workbench = createWorkbench();
  const projectId = "resource-presentation";
  const page = { kind: "page" as const, extensionId: "example.documents", id: "document" };
  const resource = { type: "document", id: "one", extensionId: page.extensionId, projectId, label: "Draft" };
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: "document", title: "Document", body: { kind: "react", render: () => null } });
  const panel = { kind: "placement" as const, extensionId: page.extensionId, id: "preview" };
  workbench.modePlacements.registerPlacement({
    id: panel.id,
    ref: panel,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "document" }],
        view: { kind: "view", id: "document" },
        cardinality: "many",
      },
    },
  });
  workbench.pages.registerPage({
    id: "document",
    ref: page,
    path: "document",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "panels", empty: { kind: "view", id: "document" } },
    slots: [],
  });
  let icon = "file-pen";
  const subscription = watchOpenExtensionResource(workbench, {
    projectId,
    metadata: {
      ...emptyDashboardExtensionMetadata,
      resourcePresentations: [
        {
          extensionId: "example.publishing",
          resourceKind: { kind: "resource-kind", extensionId: page.extensionId, id: "document" },
          resolveCommand: "example.publishing.command.present",
          refreshEvents: ["example.publishing.published"],
        },
      ],
    },
    executeCommand: async (_projectId, commandId, body) =>
      ({
        commandId,
        extensionId: "example.publishing",
        outcome: {
          ok: true,
          status: "success",
          value: {
            ...(body as { resource: ResourceRef }).resource,
            icon,
            iconColor: "fg.success",
            iconLabel: "Published",
          },
        },
      }) as CommandExecutionResult,
  });
  try {
    workbench.pageLocations.setProject(projectId);
    workbench.pageLocations.navigate({ kind: "page", page, resource });
    workbench.modePlacements.openPlacement({ panel, resource: { ...resource, id: "two" }, open: "pin" });
    await settle();
    expect(workbench.getPrimaryResource()).toMatchObject({ ...resource, icon: "file-pen" });
    icon = "file-check";
    if (trigger === "reset") publishExtensionEventReset({ projectId, extensionId: "example.publishing" });
    else publishExtensionEvent({ id: "example.publishing.published", projectId });
    await settle();
    expect(workbench.getPrimaryResource()).toMatchObject({
      ...resource,
      icon: "file-check",
      iconColor: "fg.success",
      iconLabel: "Published",
    });
    expect(workbench.layout.getActivePanel("side")?.resource).toMatchObject({
      ...resource,
      id: "two",
      icon: "file-check",
      iconColor: "fg.success",
      iconLabel: "Published",
    });
  } finally {
    subscription.dispose();
    await workbench.dispose();
  }
});
