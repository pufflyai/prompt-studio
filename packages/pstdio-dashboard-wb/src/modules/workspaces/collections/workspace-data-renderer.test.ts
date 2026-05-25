import { afterEach, describe, expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
import { seedDashboardWorkbenchRows } from "@/test-utils/dashboard-data-fixture";
import {
  applyWorkspaceStatusData,
  createWorkspaceAttributes,
  createWorkspaceRows,
  createWorkspaceRowsWithStatusData,
  getWorkspaceAttributesSnapshot,
  resolveWorkspaceBoardColumnConfig,
  updateWorkspaceStatusAttribute,
  workspaceDefaultSettings,
} from "./workspace-data-renderer";

const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
  };
};

const originalFetch = globalThis.fetch;
const syncedTables = [
  "projects",
  "repos",
  "project_repos",
  "tickets",
  "workspaces",
  "files",
  "ticket_workspaces",
  "workspace_artifacts",
  "sessions",
  "workspace_sessions",
] as const;

const toUrl = (input: URL | RequestInfo) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

describe("workspace data renderer", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
    globalThis.fetch = originalFetch;
    for (const table of syncedTables) getWriter(table)?.truncateAndWrite([]);
  });

  test("declares the generic attribute set without extension status data", () => {
    const attributeIds = createWorkspaceAttributes().map((attribute) => attribute.id);
    expect(attributeIds).toEqual(["id", "type", "updated", "diffOverview"]);
    expect(attributeIds).not.toContain("assignee");
    expect(workspaceDefaultSettings.columnGrouping).toBe("none");
    expect(workspaceDefaultSettings.displayProperties).not.toContain("status");
  });

  test("returns a stable workspace attributes snapshot for React subscriptions", () => {
    expect(getWorkspaceAttributesSnapshot()).toBe(getWorkspaceAttributesSnapshot());
  });

  test("workspace rows do not expose an assignee attribute", () => {
    for (const row of createWorkspaceRows()) {
      expect(row.attributes).not.toHaveProperty("assignee");
    }
  });

  test("adds the status attribute from extension status data", () => {
    const status = createWorkspaceAttributes({
      attribute: {
        id: "status",
        label: "Status",
        kind: "enum",
        filterable: true,
        groupable: true,
        sortable: true,
        displayable: true,
        editable: true,
      },
      statuses: [{ id: "review-ready", label: "Review Ready", color: "purple", icon: "eye", sortOrder: 1 }],
      valuesByWorkspaceId: {},
      defaultSettings: { viewMode: "board", columnGrouping: "status" },
    }).find((attribute) => attribute.id === "status");

    expect(status?.filterable).toBe(true);
    expect(status?.groupable).toBe(true);
    expect(status?.sortable).toBe(true);
    expect(status?.editable).toBe(true);
    if (status?.type.kind !== "enum") throw new Error("expected enum kind");
    expect(status.type.options).toEqual([
      { value: "review-ready", label: "Review Ready", color: "purple", icon: "eye" },
    ]);
  });

  test("merges extension status values into workspace rows", () => {
    const [row] = applyWorkspaceStatusData(
      [
        {
          id: "dashboard-workbench://workspace/workspace-1",
          title: "Workspace",
          resource: { kind: "workspace", uri: "dashboard-workbench://workspace/workspace-1", id: "workspace-1" },
          attributes: { id: "PS-1_A1", type: "worktree", updated: "2026-05-25T00:00:00.000Z" },
        },
      ],
      {
        attribute: {
          id: "status",
          label: "Status",
          kind: "enum",
          filterable: true,
          groupable: true,
          sortable: true,
          displayable: true,
          editable: true,
        },
        statuses: [{ id: "review-ready", label: "Review Ready", color: "purple", sortOrder: 1 }],
        valuesByWorkspaceId: {
          "workspace-1": { status: "review-ready", updatedAt: "2026-05-25T00:00:00.000Z" },
        },
        defaultSettings: { viewMode: "board", columnGrouping: "status" },
      },
    );

    expect(row?.attributes.status).toBe("review-ready");
  });

  test("builds toolbar rows with extension status values for filter counts", () => {
    seedDashboardWorkbenchRows();

    const rows = createWorkspaceRowsWithStatusData("project-1", {
      attribute: {
        id: "status",
        label: "Status",
        kind: "enum",
        filterable: true,
        groupable: true,
        sortable: true,
        displayable: true,
        editable: true,
      },
      statuses: [
        { id: "wip", label: "wip", color: "blue", sortOrder: 10 },
        { id: "review-ready", label: "review-ready", color: "amber", sortOrder: 20 },
      ],
      valuesByWorkspaceId: {
        "workspace-1": { status: "wip", updatedAt: "2026-05-25T00:00:00.000Z" },
        "workspace-2": { status: "review-ready", updatedAt: "2026-05-25T00:00:00.000Z" },
      },
      defaultSettings: { viewMode: "board", columnGrouping: "status" },
    });

    expect(rows.map((row) => row.attributes.status)).toEqual(["wip", "review-ready"]);
  });

  test("diff overview uses a custom renderer and is displayed by default", () => {
    const attributes = createWorkspaceAttributes();
    const diffOverview = attributes.find((attribute) => attribute.id === "diffOverview");

    expect(diffOverview?.displayable).toBe(true);
    expect(workspaceDefaultSettings.displayProperties).toContain("diffOverview");
    expect(typeof diffOverview?.render).toBe("function");
    expect(
      diffOverview?.render?.("+8 -2", {
        id: "workspace-1",
        title: "Workspace",
        attributes: { diffOverview: "+8 -2", diffAdditions: 8, diffDeletions: 2 },
      }),
    ).not.toBeNull();
  });

  test("enables drag in and out for workspace board columns", () => {
    expect(resolveWorkspaceBoardColumnConfig()).toEqual({ canDragIn: true, canDragOut: true });
  });

  test("moves workspace cards by executing the workspace automations status command", async () => {
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: "http://localhost:19840" };

    const calls: Array<{ method: string; url: string; body?: string }> = [];
    globalThis.fetch = Object.assign(
      async (input: URL | RequestInfo, init?: RequestInit | BunFetchRequestInit) => {
        calls.push({
          method: init?.method ?? "GET",
          url: toUrl(input),
          body: typeof init?.body === "string" ? init.body : undefined,
        });
        return new Response(
          JSON.stringify({
            commandId: "pstdio-core-workspace-automations.workspaceStatus.set",
            extensionId: "pstdio.pstdio-core-workspace-automations",
            outcome: {
              ok: true,
              status: "success",
              value: { workspaceId: "workspace-1", status: "review-ready" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
      { preconnect: originalFetch.preconnect?.bind(originalFetch) },
    ) as typeof fetch;

    await updateWorkspaceStatusAttribute({
      projectId: "project-1",
      rowId: "dashboard-workbench://workspace/workspace-1",
      attributeId: "status",
      value: "review-ready",
    });

    expect(calls).toEqual([
      {
        method: "POST",
        url: "http://localhost:19840/v1/projects/project-1/extensions/commands/pstdio-core-workspace-automations.workspaceStatus.set/execute",
        body: JSON.stringify({
          params: { workspaceId: "workspace-1", status: "review-ready" },
          source: "dashboard",
        }),
      },
    ]);
  });
});
