import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import {
  type DashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionContributions } from "./extension-contribution-registration";

const ticketsRecord = {
  id: "pstdio-core-tickets.tickets",
  extensionId: "pstdio.pstdio-core-tickets",
  title: "Tickets",
  resourceKind: "ticket",
  queryCommandId: "pstdio-core-tickets.query-tickets",
};

const modalCreateMetadata: DashboardExtensionMetadata = {
  ...emptyDashboardExtensionMetadata,
  dataRenderers: [
    {
      ...ticketsRecord,
      createRow: { commandId: "tickets.create", columnParam: "status" },
    },
  ],
  views: [
    {
      id: "tickets.create-modal",
      extensionId: "pstdio.pstdio-core-tickets",
      slotId: "workbench.modal",
      target: "workbench.main",
      role: "modal",
      resourceKind: "ticket",
      title: "Create ticket",
      webview: {
        entry: {
          kind: "package-asset",
          path: "./create.tsx",
          baseUrl: "file:///extension/extension.ts",
        },
        runtimeUrl: "/runtime.html",
        moduleUrl: "/create.js",
      },
    },
  ],
};

const successResponse = (commandId: string): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.pstdio-core-tickets",
  outcome: { ok: true, status: "success", value: {} },
});

describe("registerExtensionDataRenderers modal create", () => {
  test("opens the created resource after modal create succeeds", async () => {
    const workbench = createWorkbenchCore();
    const calls: Array<{ commandId: string }> = [];
    const openedResources: Array<{ id?: string; kind: string; label?: string }> = [];

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => [
        ...registerExtensionContributions({
          ctx,
          executeCommand: async (_projectId, commandId) => {
            calls.push({ commandId });
            return successResponse(commandId);
          },
          metadata: modalCreateMetadata,
          projectId: "proj-1",
        }),
        ctx.resources.registerOpener({
          id: "test.ticket-opener",
          canOpen: (resource) => resource.kind === "ticket",
          open: (resource) => {
            openedResources.push(resource);
          },
        }),
      ],
    });

    await Promise.resolve();
    workbench.renderers.getDataRenderer(ticketsRecord.id)?.onCreateRow?.("todo");
    await Promise.resolve();

    expect(calls.find((call) => call.commandId === "tickets.create")).toBeUndefined();
    const overlay = workbench.layout.getLayout().regions.overlay;
    const placement = overlay.widgets.find(
      (widget) => widget.contributionId === "dashboard-workbench.extension-view.tickets.create-modal",
    );
    expect(placement?.resource?.id).toBe("todo");

    publishExtensionCommandEvent({
      commandId: "tickets.create",
      extensionId: "pstdio.pstdio-core-tickets",
      outcome: {
        ok: true,
        status: "success",
        value: { id: "ticket-1", shorthand: "PS-1", title: "Created ticket" },
      },
    });
    await Promise.resolve();

    expect(workbench.layout.getLayout().regions.overlay.widgets).toHaveLength(0);
    expect(openedResources).toHaveLength(1);
    expect(openedResources[0]).toMatchObject({
      kind: "ticket",
      id: "ticket-1",
      label: "PS-1 Created ticket",
      metadata: { projectId: "proj-1" },
    });
  });

  test("refreshes safely when modal placement is gone before create succeeds", async () => {
    const workbench = createWorkbenchCore();
    let refreshes = 0;

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) =>
        registerExtensionContributions({
          ctx,
          executeCommand: async (_projectId, commandId) => successResponse(commandId),
          metadata: modalCreateMetadata,
          projectId: "proj-1",
        }),
    });
    workbench.renderers.onDidRefreshDataRenderer((event) => {
      if (event.dataRendererId === ticketsRecord.id) refreshes += 1;
    });

    await Promise.resolve();
    workbench.renderers.getDataRenderer(ticketsRecord.id)?.onCreateRow?.("todo");
    await Promise.resolve();

    const placement = workbench.layout
      .getLayout()
      .regions.overlay.widgets.find(
        (widget) => widget.contributionId === "dashboard-workbench.extension-view.tickets.create-modal",
      );
    expect(placement).toBeDefined();
    workbench.layout.closeWidget(placement!.widgetId);

    expect(() =>
      publishExtensionCommandEvent({
        commandId: "tickets.create",
        extensionId: "pstdio.pstdio-core-tickets",
        outcome: {
          ok: true,
          status: "success",
          value: { id: "ticket-1", title: "Created ticket" },
        },
      }),
    ).not.toThrow();

    expect(refreshes).toBe(1);
  });
});
