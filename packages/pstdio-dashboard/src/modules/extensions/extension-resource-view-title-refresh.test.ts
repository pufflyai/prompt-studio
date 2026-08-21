import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import { registerExtensionResourceHierarchy } from "./extension-resource-hierarchy";
import { registerExtensionResourceView } from "./extension-resource-view";

const metadata = {
  extensions: [],
  commands: [],
  diagnostics: [],
  menuContributions: [],
  modes: [
    {
      id: "tickets.ticket",
      extensionId: "tickets",
      modeId: "tickets.ticket",
      label: "Ticket",
      icon: "FileText",
      panelRegions: ["main", "secondary", "side"],
      resources: { ticket: { slots: { primary: { region: "main" } } } },
    },
  ],
  resourceKinds: [
    {
      id: "ticket",
      extensionId: "tickets",
      surface: "primary",
      slots: { primary: { cardinality: "one", external: false } },
    },
  ],
  resourcePanels: [
    {
      id: "tickets.ticket.primary",
      extensionId: "tickets",
      resourceKind: "ticket",
      panel: "tickets.editor",
      slot: "primary",
    },
  ],
  routes: [],
  settingsPanels: [],
  treeItems: [],
  kanbanRenderers: [
    {
      id: "tickets.board",
      extensionId: "tickets",
      title: "Tickets",
      resourceKind: "ticket",
      queryHandlerId: "tickets.query",
    },
  ],
  treeRenderers: [],
  panels: [
    {
      id: "tickets.editor",
      extensionId: "tickets",
      show: { region: "main" },
      title: "Ticket",
      renderer: { kind: "file", id: "tickets.content" },
      panelMenus: [
        {
          id: "tickets.files",
          extensionId: "tickets",
          ownerPanelId: "tickets.editor",
          title: "Files",
          side: "left",
          renderer: { kind: "tree", id: "tickets.files" },
        },
      ],
    },
  ],
} satisfies DashboardExtensionMetadata;

const ticketResource = {
  kind: "ticket",
  uri: "dashboard-workbench://ticket/ticket-1",
  id: "ticket-1",
  label: "T-1 Old title",
  metadata: { projectId: "project-1" },
} satisfies ResourceRef;

describe("registerExtensionResourceView title refresh", () => {
  test("updates the editor title without rebinding the editor resource", async () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "tickets.ticket", label: "Ticket", activate: () => undefined });
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.layout.registerPanel({
      id: "tickets.editor",
      title: "Ticket",
      region: "main",
      rendererId: "tickets.content",
      resourceKinds: ["ticket"],
      panelMenus: [
        {
          id: "tickets.files",
          title: "Files",
          side: "left",
          rendererId: "tickets.files",
        },
      ],
    });
    workbench.layout.registerPanel({
      id: "left.scratch",
      title: "Scratch",
      region: "sidenav",
      rendererId: "left.scratch",
      singleton: false,
    });
    const disposable = workbench.registerModule({
      id: "test.extension-resource-view",
      activate: (ctx) => registerExtensionResourceView(ctx, { metadata, projectId: "project-1" }),
    });

    try {
      await workbench.resources.openResource(ticketResource, { replaceActive: true });

      const beforeSave = workbench.layout.getLayout().regions.main.widgets[0];
      const companionBeforeSave = workbench.layout.getLayout().regions["main-left-menu"].widgets[0];
      expect(beforeSave?.resource?.id).toBe("ticket-1");
      expect(companionBeforeSave?.resource?.id).toBe("ticket-1");
      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["T-1 Old title"]);
      const scratch = workbench.layout.openPanel("left.scratch", { title: "Scratch" });

      publishExtensionCommandEvent({
        commandId: "other.save",
        extensionId: "other",
        outcome: { ok: true, status: "success", value: { id: "ticket-1", shorthand: "T-1", title: "Wrong title" } },
      });

      expect(workbench.layout.getLayout().regions.main.widgets[0]?.title).toBe("T-1 Old title");
      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["T-1 Old title"]);
      expect(workbench.layout.getLayout().activeWidgetId).toBe(scratch.instanceId);

      publishExtensionCommandEvent({
        commandId: "tickets.save",
        extensionId: "tickets",
        outcome: { ok: true, status: "success", value: { id: "ticket-1", shorthand: "T-1", title: "New title" } },
      });

      const afterSave = workbench.layout.getLayout().regions.main.widgets[0];
      expect(afterSave?.title).toBe("T-1 New title");
      expect(afterSave?.widgetId).toBe(beforeSave?.widgetId);
      expect(afterSave?.resource).toBe(beforeSave?.resource);
      expect(afterSave?.resource?.label).toBe("T-1 New title");
      expect(workbench.layout.getLayout().regions["main-left-menu"].widgets[0]?.title).toBe("T-1 New title");
      expect(workbench.layout.getLayout().regions["main-left-menu"].widgets[0]?.widgetId).toBe(
        companionBeforeSave?.widgetId,
      );
      expect(workbench.layout.getLayout().regions["main-left-menu"].widgets[0]?.resource).toBe(
        companionBeforeSave?.resource,
      );
      expect(workbench.layout.getLayout().regions["main-left-menu"].widgets[0]?.resource?.label).toBe("T-1 New title");
      expect(workbench.layout.getLayout().regions.sidenav.widgets[0]?.widgetId).toBe(scratch.instanceId);
      expect(workbench.layout.getLayout().activeWidgetId).toBe(scratch.instanceId);
      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["T-1 New title"]);
    } finally {
      disposable.dispose();
    }
  });

  test("reloads the complete breadcrumb trail when the ticket renderer refreshes", async () => {
    let storedResource: ResourceRef | undefined;
    const workbench = createWorkbenchCore({
      lastResourcePersistence: {
        getLastResource: () => storedResource,
        setLastResource: (resource) => {
          storedResource = resource ? structuredClone(resource) : undefined;
        },
      },
    });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "tickets.ticket", label: "Ticket", activate: () => undefined });
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.renderers.registerKanbanRenderer({
      id: "tickets.board",
      title: "Tickets",
      resourceKind: "ticket",
      attributes: [],
      executeQuery: () => [],
    });
    workbench.layout.registerPanel({
      id: "tickets.editor",
      title: "Ticket",
      region: "main",
      rendererId: "tickets.content",
      resourceKinds: ["ticket"],
      panelMenus: [
        {
          id: "tickets.files",
          title: "Files",
          side: "left",
          rendererId: "tickets.files",
        },
      ],
    });

    const refreshedResource = {
      type: "ticket",
      id: "ticket-1",
      label: "T-1 New title",
      metadata: {
        resourceParent: {
          type: "ticket",
          id: "ticket-0",
          label: "T-0 New parent",
          metadata: {
            resourceParent: { type: "extension-view", id: "tickets.board", label: "Tickets" },
          },
        },
      },
    };
    const executeCommand = async () => ({
      commandId: "tickets.query",
      extensionId: "tickets",
      outcome: {
        ok: true as const,
        status: "success" as const,
        value: { rows: [{ id: "ticket-1", title: "New title", resource: refreshedResource }] },
      },
    });
    const disposable = workbench.registerModule({
      id: "test.extension-resource-refresh",
      activate: (ctx) => [
        registerExtensionResourceHierarchy(ctx, { metadata, projectId: "project-1" }),
        ...registerExtensionResourceView(ctx, { metadata, projectId: "project-1", executeCommand }),
      ],
    });
    const resource = {
      ...ticketResource,
      metadata: {
        projectId: "project-1",
        resourceParent: {
          type: "ticket",
          id: "ticket-0",
          label: "T-0 Old parent",
          metadata: {
            resourceParent: { type: "extension-view", id: "tickets.board", label: "Tickets" },
          },
        },
      },
    } satisfies ResourceRef;

    try {
      await workbench.resources.openResource(resource, { replaceActive: true });
      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
        "Tickets",
        "T-0 Old parent",
        "T-1 Old title",
      ]);

      workbench.renderers.refreshKanbanRenderer("tickets.board");
      await Promise.resolve();
      await Promise.resolve();

      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
        "Tickets",
        "T-0 New parent",
        "T-1 New title",
      ]);
      expect(workbench.layout.getLayout().regions.main.widgets[0]?.title).toBe("T-1 New title");
      expect(storedResource?.label).toBe("T-1 New title");
      expect((storedResource?.metadata?.resourceParent as { label?: string }).label).toBe("T-0 New parent");
    } finally {
      disposable.dispose();
    }
  });
});
