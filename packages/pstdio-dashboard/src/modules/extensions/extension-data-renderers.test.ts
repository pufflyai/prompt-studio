import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  type DashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
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

describe("registerExtensionDataRenderers", () => {
  test("registers the resource kind and widget for each data renderer", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => registerExtensionDataRenderers(ctx, { metadata, projectId: "proj-1" }),
    });

    expect(workbench.resources.getKind("ticket")).toBeDefined();
    expect(workbench.layout.getWidget("pstdio-core-tickets.tickets")).toMatchObject({
      area: "main",
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
      expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
        ticketsRecord.id,
      ]);

      getWriter("installed_extension_sources")?.upsert({ id: "pstdio-planner" });
      await flushMicrotasks();

      expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
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
