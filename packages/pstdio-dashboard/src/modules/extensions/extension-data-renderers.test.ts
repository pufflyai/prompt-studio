import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  type DashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionContributions } from "./extension-contribution-registration";
import { buildExtensionDataRendererSidebarSections, registerExtensionDataRenderers } from "./extension-data-renderers";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks } from "./module-test-fixtures";

const ticketsRecord = {
  id: "pstdio-core-tickets.tickets",
  extensionId: "pstdio.pstdio-core-tickets",
  title: "Tickets",
  resourceKind: "ticket",
  queryCommandId: "pstdio-core-tickets.query-tickets",
};

const metadata: DashboardExtensionMetadata = {
  ...emptyDashboardExtensionMetadata,
  dataRenderers: [ticketsRecord],
};

const successResponse = (commandId: string): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.pstdio-planner",
  outcome: { ok: true, status: "success", value: {} },
});

describe("registerExtensionDataRenderers", () => {
  test("registers the resource kind and widget for each data renderer", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => registerExtensionDataRenderers(ctx, { metadata, projectId: "proj-1" }),
    });

    expect(workbench.resources.getKind("ticket")).toBeDefined();
    expect(workbench.layout.getWidget("pstdio-core-tickets.tickets")).toMatchObject({
      region: "main",
      role: "location",
      rendererId: "pstdio-core-tickets.tickets",
      singleton: true,
    });
  });

  test("opens ticket rows with the extension-provided resource icon", async () => {
    const workbench = createWorkbenchCore();
    const openedResources: Array<{ icon?: string; id?: string; kind: string }> = [];

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => [
        ...registerExtensionDataRenderers(ctx, { metadata, projectId: "proj-1" }),
        ctx.resources.registerOpener({
          id: "test.ticket-opener",
          canOpen: (resource) => resource.kind === "ticket",
          open: (resource) => {
            openedResources.push(resource);
          },
        }),
      ],
    });

    workbench.renderers.getDataRenderer("pstdio-core-tickets.tickets")?.onRowClick?.({
      id: "t1",
      title: "T-1",
      resource: { type: "ticket", id: "t1", label: "T-1", icon: "component" },
      attributes: {},
    });

    await Promise.resolve();

    expect(openedResources).toHaveLength(1);
    expect(openedResources[0]).toMatchObject({ kind: "ticket", id: "t1", icon: "component" });
  });

  test("opens ticket rows after the query has lifted the row resource", async () => {
    const workbench = createWorkbenchCore();
    const openedResources: Array<{ id?: string; kind: string }> = [];

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => [
        ...registerExtensionDataRenderers(ctx, { metadata, projectId: "proj-1" }),
        ctx.resources.registerOpener({
          id: "test.ticket-opener",
          canOpen: (resource) => resource.kind === "ticket",
          open: (resource) => {
            openedResources.push(resource);
          },
        }),
      ],
    });

    // The data view re-resolves the row's resource on click, but by then the query
    // has already lifted it into a workbench ResourceRef. The click must not re-lift
    // an already-lifted resource (which would drop its kind and match no opener).
    workbench.renderers.getDataRenderer("pstdio-core-tickets.tickets")?.onRowClick?.({
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

    await Promise.resolve();

    expect(openedResources).toHaveLength(1);
    expect(openedResources[0]).toMatchObject({ kind: "ticket", id: "t1" });
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
      dataRenderers: [
        {
          ...ticketsRecord,
          extensionId: "pstdio.pstdio-planner",
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
            return successResponse(commandId);
          },
          metadata: plannerMetadata,
          projectId: "proj-1",
        }),
    });

    const renderer = workbench.renderers.getDataRenderer(ticketsRecord.id);
    let refreshes = 0;
    workbench.renderers.onDidRefreshDataRenderer((event) => {
      if (event.dataRendererId === ticketsRecord.id) refreshes += 1;
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

  test("keeps an open extension data renderer after metadata refresh", async () => {
    const loadMetadata = mock(async () => metadata);
    const loadAppearance = mock(async () => emptyAppearance);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();

      const ticketsResource = buildExtensionDataRendererSidebarSections({ metadata, projectId: "project-1" })[0]
        ?.nodes[0]?.resource;

      await workbench.resources.openResource(ticketsResource!);
      expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
        ticketsRecord.id,
      ]);

      getWriter("installed_extension_sources")?.upsert({ id: "pstdio-planner" });
      await flushMicrotasks();

      expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
        ticketsRecord.id,
      ]);
      expect(workbench.getPrimaryResource()?.uri).toBe(ticketsResource?.uri);
    } finally {
      disposable.dispose();
      getWriter("installed_extension_sources")?.truncateAndWrite([]);
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});

describe("registerExtensionDataRenderers adapter hooks", () => {
  test("decorates workspace-badge attributes with a host renderer", async () => {
    const workbench = createWorkbenchCore();
    const workspaceMetadata: DashboardExtensionMetadata = {
      ...emptyDashboardExtensionMetadata,
      dataRenderers: [
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
      activate: (ctx) => registerExtensionDataRenderers(ctx, { metadata: workspaceMetadata, projectId: "proj-1" }),
    });

    await Promise.resolve();

    const attributes = workbench.renderers.getDataRenderer(ticketsRecord.id)?.attributes;
    if (!attributes || Array.isArray(attributes)) throw new Error("expected reactive attributes source");
    const workspaceAttribute = attributes.getSnapshot().find((attribute) => attribute.id === "workspace");
    expect(typeof workspaceAttribute?.render).toBe("function");
  });
});

describe("buildExtensionDataRendererSidebarSections", () => {
  test("lists a nav node per data renderer", () => {
    const sections = buildExtensionDataRendererSidebarSections({ metadata, projectId: "proj-1" });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.nodes).toHaveLength(1);
    expect(sections[0]?.nodes[0]).toMatchObject({ label: "Tickets" });
    expect(sections[0]?.nodes[0]?.resource).toMatchObject({
      kind: "dashboard-view",
      id: "pstdio-core-tickets.tickets",
    });
  });

  test("uses the ticket board icon for ticket data renderers", () => {
    const sections = buildExtensionDataRendererSidebarSections({ metadata, projectId: "proj-1" });
    const node = sections[0]?.nodes[0];

    expect(node?.icon).toBe("square-kanban");
    expect(node?.resource?.icon).toBe("square-kanban");
  });

  test("returns nothing without a project or data renderers", () => {
    expect(buildExtensionDataRendererSidebarSections({ metadata, projectId: undefined })).toEqual([]);
    expect(
      buildExtensionDataRendererSidebarSections({ metadata: emptyDashboardExtensionMetadata, projectId: "proj-1" }),
    ).toEqual([]);
  });
});
