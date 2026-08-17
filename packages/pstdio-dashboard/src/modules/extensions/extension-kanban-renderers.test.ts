import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  type DashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionContributions } from "./extension-contribution-registration";
import { registerExtensionKanbanRenderers } from "./extension-kanban-renderers";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks } from "./module-test-fixtures";

const ticketsRecord = {
  id: "pstdio-core-tickets.tickets",
  extensionId: "pstdio.pstdio-core-tickets",
  title: "Tickets",
  resourceKind: "ticket",
  queryHandlerId: "pstdio-core-tickets.tickets.query",
  rowActivationHandlerId: "pstdio-core-tickets.tickets.onRowActivate",
};

const metadata: DashboardExtensionMetadata = {
  ...emptyDashboardExtensionMetadata,
  kanbanRenderers: [ticketsRecord],
  panels: [
    {
      id: "pstdio-core-tickets.tickets",
      extensionId: ticketsRecord.extensionId,
      title: "Tickets",
      region: "main",
      closable: false,
      renderer: { kind: "kanban", id: ticketsRecord.id },
    },
  ],
};

const successResponse = (commandId: string): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.pstdio-planner",
  outcome: { ok: true, status: "success", value: {} },
});

describe("registerExtensionKanbanRenderers", () => {
  test("registers the resource kind and explicitly declared panel", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => registerExtensionKanbanRenderers(ctx, { metadata, projectId: "proj-1" }),
    });

    expect(workbench.resources.getKind("ticket")).toBeDefined();
    expect(workbench.layout.getPanel("pstdio-core-tickets.tickets")).toMatchObject({
      region: "main",
      closable: false,
      rendererId: "pstdio-core-tickets.tickets",
      singleton: true,
    });
  });

  test("routes row actions with user-facing params through the shared params dialog", async () => {
    const workbench = createWorkbenchCore();
    const calls: Array<{ commandId: string; body: unknown }> = [];
    const plannerMetadata: DashboardExtensionMetadata = {
      ...emptyDashboardExtensionMetadata,
      commands: [
        {
          id: "pstdio-planner.refine-ticket",
          extensionId: "pstdio.pstdio-planner",
          title: "Refine ticket",
          params: {
            ticket: { type: "text", label: "Ticket" },
            rowId: { type: "text", label: "Ticket row" },
            context: { type: "longtext", label: "Additional context" },
          },
        },
      ],
      menuContributions: [
        {
          id: "pstdio-planner.refine-ticket.menu.0",
          extensionId: "pstdio.pstdio-planner",
          commandId: "pstdio-planner.refine-ticket",
          slotId: "ticket.headerOverflow",
          label: "Refine ticket",
          icon: "sparkles",
        },
      ],
      kanbanRenderers: [
        {
          ...ticketsRecord,
          extensionId: "pstdio.pstdio-planner",
          refreshEventIds: ["tickets.changed"],
          rowActions: [
            {
              id: "refine-ticket",
              label: "Refine ticket",
              icon: "sparkles",
              commandId: "pstdio-planner.refine-ticket",
            },
          ],
        },
      ],
    };

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) =>
        registerExtensionContributions({
          ctx,
          executeCommand: async (_projectId, commandId, body) => {
            calls.push({ commandId, body });
            return { ...successResponse(commandId), eventIds: ["tickets.changed"] };
          },
          metadata: plannerMetadata,
          projectId: "proj-1",
        }),
    });

    const renderer = workbench.renderers.getKanbanRenderer(ticketsRecord.id);
    let refreshes = 0;
    workbench.renderers.onDidRefreshKanbanRenderer((event) => {
      if (event.kanbanRendererId === ticketsRecord.id) refreshes += 1;
    });
    renderer
      ?.getRowContextMenuActions?.({
        id: "ticket-1",
        title: "Ticket 1",
        resource: { type: "ticket", id: "ticket-1", label: "T-1", icon: "component" },
        attributes: {},
      })?.[0]
      ?.onClick();

    const request = workbench.commandPalette.getParamsRequest();

    expect(calls).toEqual([]);
    expect(request?.label).toBe("Refine ticket");
    expect(request?.record.command.id).toBe("dashboard.extension.menu.pstdio-planner.refine-ticket.menu.0");
    expect(request?.record.command.params).toEqual({
      context: { type: "longtext", label: "Additional context" },
    });
    expect(request?.args).toEqual({ rowId: "ticket-1" });
    expect(request?.context?.resource).toMatchObject({ kind: "ticket", id: "ticket-1" });

    await workbench.commands.executeCommand(
      request!.record.command.id,
      { ...(request!.args as Record<string, unknown>), context: "Tighten scope." },
      request!.context,
    );

    expect(calls.at(-1)).toMatchObject({
      commandId: "pstdio-planner.refine-ticket",
      body: {
        params: { rowId: "ticket-1", context: "Tighten scope." },
        resource: { type: "ticket", id: "ticket-1" },
      },
    });
    expect(refreshes).toBe(1);
  });

  test("keeps an open extension kanban renderer after metadata refresh", async () => {
    const loadMetadata = mock(async () => metadata);
    const loadAppearance = mock(async () => emptyAppearance);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();

      workbench.layout.openPanel(ticketsRecord.id);
      expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
        ticketsRecord.id,
      ]);

      getWriter("installed_extension_sources")?.upsert({ id: "pstdio-planner" });
      await flushMicrotasks();

      expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
        ticketsRecord.id,
      ]);
    } finally {
      disposable.dispose();
      getWriter("installed_extension_sources")?.truncateAndWrite([]);
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});

describe("registerExtensionKanbanRenderers row activation", () => {
  test("opens ticket rows with the extension-provided resource icon", async () => {
    const workbench = createWorkbenchCore();
    const openedResources: Array<{ icon?: string; id?: string; kind: string; uri: string }> = [];

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => [
        ...registerExtensionKanbanRenderers(ctx, {
          metadata,
          projectId: "proj-1",
          executeCommand: async () => ({
            ...successResponse("pstdio-core-tickets.tickets.onRowActivate"),
            outcome: {
              ok: true,
              status: "success",
              value: {
                kind: "resource",
                resource: { type: "ticket", id: "t1", label: "T-1", icon: "component" },
                input: { strategy: "replace-active" },
              },
            },
          }),
        }),
        ctx.layout.registerPanel({
          id: "test.ticket",
          title: "Ticket",
          region: "main",
          rendererId: "test",
          closable: false,
        }),
        ctx.resources.registerPresenter({
          id: "test.ticket-presenter",
          canOpen: (resource) => resource.kind === "ticket",
          open: (resource) => {
            openedResources.push(resource);
            return ctx.layout.openPanel("test.ticket", { resource });
          },
        }),
      ],
    });

    await workbench.renderers.getKanbanRenderer("pstdio-core-tickets.tickets")?.onRowActivate?.({
      id: "t1",
      title: "T-1",
      resource: { type: "ticket", id: "t1", label: "T-1", icon: "component" },
      attributes: {},
    });

    expect(openedResources).toHaveLength(1);
    expect(openedResources[0]).toMatchObject({
      kind: "ticket",
      id: "t1",
      icon: "component",
      uri: "dashboard-workbench://ticket/t1",
    });
  });

  test("opens ticket rows after the query has lifted the row resource", async () => {
    const workbench = createWorkbenchCore();
    const openedResources: Array<{ id?: string; kind: string }> = [];

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => [
        ...registerExtensionKanbanRenderers(ctx, {
          metadata,
          projectId: "proj-1",
          executeCommand: async () => ({
            ...successResponse("pstdio-core-tickets.tickets.onRowActivate"),
            outcome: {
              ok: true,
              status: "success",
              value: {
                kind: "resource",
                resource: { type: "ticket", id: "t1", label: "T-1", metadata: { projectId: "proj-1" } },
                input: { strategy: "replace-active" },
              },
            },
          }),
        }),
        ctx.layout.registerPanel({
          id: "test.ticket",
          title: "Ticket",
          region: "main",
          rendererId: "test",
          closable: false,
        }),
        ctx.resources.registerPresenter({
          id: "test.ticket-presenter",
          canOpen: (resource) => resource.kind === "ticket",
          open: (resource) => {
            openedResources.push(resource);
            return ctx.layout.openPanel("test.ticket", { resource });
          },
        }),
      ],
    });

    await workbench.renderers.getKanbanRenderer("pstdio-core-tickets.tickets")?.onRowActivate?.({
      id: "t1",
      title: "T-1",
      resource: {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/t1",
        id: "t1",
        label: "T-1",
        metadata: { projectId: "proj-1" },
      },
      attributes: {},
    });

    expect(openedResources).toHaveLength(1);
    expect(openedResources[0]).toMatchObject({ kind: "ticket", id: "t1" });
  });
});

describe("registerExtensionKanbanRenderers adapter hooks", () => {
  test("decorates workspace-badge attributes with a host renderer", async () => {
    const workbench = createWorkbenchCore();
    const workspaceMetadata: DashboardExtensionMetadata = {
      ...emptyDashboardExtensionMetadata,
      kanbanRenderers: [
        {
          ...ticketsRecord,
          attributes: [
            {
              id: "workspace",
              label: "Workspace",
              type: { kind: "string" },
              displayable: true,
              display: { kind: "workspace-badge", itemsAttributeId: "workspaceItems" },
            },
          ],
        },
      ],
    };

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => registerExtensionKanbanRenderers(ctx, { metadata: workspaceMetadata, projectId: "proj-1" }),
    });

    await Promise.resolve();

    const attributes = workbench.renderers.getKanbanRenderer(ticketsRecord.id)?.attributes;
    if (!attributes || Array.isArray(attributes)) throw new Error("expected reactive attributes source");
    const workspaceAttribute = attributes.getSnapshot().find((attribute) => attribute.id === "workspace");
    expect(typeof workspaceAttribute?.render).toBe("function");
  });

  test("refreshes an open kanban renderer when synced session data changes", () => {
    const workbench = createWorkbenchCore();

    const disposable = workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => registerExtensionKanbanRenderers(ctx, { metadata, projectId: "proj-1" }),
    });

    let refreshes = 0;
    workbench.renderers.onDidRefreshKanbanRenderer((event) => {
      if (event.kanbanRendererId === ticketsRecord.id) refreshes += 1;
    });

    getWriter("templates")?.upsert({ id: "template-1" });
    expect(refreshes).toBe(0);

    getWriter("sessions")?.upsert({ id: "session-1", status: "in_progress" });
    expect(refreshes).toBe(1);

    getWriter("workspace_sessions")?.upsert({ id: "workspace-session-1" });
    expect(refreshes).toBe(2);

    disposable.dispose();
    getWriter("sessions")?.upsert({ id: "session-1", status: "completed" });
    expect(refreshes).toBe(2);
  });
});
