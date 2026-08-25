import { describe, expect, test } from "bun:test";
import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { putTicket } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import { runTicketsQuery } from "./query";
import { seedDefaultStatuses } from "./seed";
import type { StoredTicket } from "./types";

const makeTicket = (overrides: Partial<StoredTicket>): StoredTicket => ({
  id: crypto.randomUUID(),
  shorthand: "T-1",
  title: "Ticket",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeWorkspace = (overrides: Partial<ExtensionWorkspace> & { id: string }): ExtensionWorkspace => ({
  name: "Workspace",
  project_id: "proj-1",
  workspace_shorthand: "T-1_A1",
  branch: "workspace/T-1_A1",
  worktree_path: "/worktrees/T-1_A1",
  anchors_json: [
    {
      type: "ticket",
      id: "ticket-1",
      label: "T-1",
      metadata: {
        shorthand: "T-1",
        resourceParent: { type: "view", viewId: "pstdio-planner.tickets" },
      },
    },
  ],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
  id: overrides.id,
});

describe("runTicketsQuery", () => {
  test("returns visible ticket rows, status attributes, and board column configs", async () => {
    const storage = createMemoryStorage();
    const statuses = await seedDefaultStatuses(storage);
    const todo = statuses.find((status) => status.isDefault)!;

    await putTicket(storage, makeTicket({ shorthand: "T-1", title: "First", statusId: todo.id, sortOrder: 0 }));
    await putTicket(storage, makeTicket({ shorthand: "T-2", title: "Second", statusId: todo.id, sortOrder: 1 }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    expect(result.rows.map((row) => row.title)).toEqual(["First", "Second"]);
    expect(result.attributes?.some((attribute) => attribute.id === "status")).toBe(true);
    expect(Object.keys(result.boardColumnConfigs ?? {})).toContain(todo.id);
  });

  test("seeds default statuses when the project has none yet", async () => {
    const storage = createMemoryStorage();
    // No explicit seed — the board must still get status columns.
    await putTicket(storage, makeTicket({ shorthand: "T-1" }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    const statusOptions = result.attributes?.find((attribute) => attribute.id === "status");
    expect(statusOptions?.type.kind).toBe("enum");
    expect(Object.keys(result.boardColumnConfigs ?? {}).length).toBeGreaterThan(0);
  });

  test("exposes only backlog as a creatable default board column", async () => {
    const storage = createMemoryStorage();

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });
    const configs = result.boardColumnConfigs ?? {};

    expect(configs.backlog?.canCreate).toBe(true);
    expect(
      Object.entries(configs)
        .filter(([statusId]) => statusId !== "backlog")
        .every(([, config]) => config.canCreate === false),
    ).toBe(true);
  });

  test("exposes default display property attributes", async () => {
    const storage = createMemoryStorage();
    await putTicket(
      storage,
      makeTicket({
        shorthand: "T-1",
        tagIds: ["default-priority-high", "default-type-bug"],
      }),
    );

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    expect(result.attributes?.map((attribute) => attribute.id)).toEqual([
      "status",
      "archived",
      "created",
      "updated",
      "id",
      "parent",
      "workspace",
      "priority",
      "type",
      "complexity",
      "default-human-requested",
    ]);
    expect(result.rows[0]?.attributes).toMatchObject({
      archived: "active",
      created: "2026-01-01T00:00:00.000Z",
      id: "T-1",
      workspace: "",
      workspaceItems: [],
      priority: "default-priority-high",
      type: "default-type-bug",
    });

    const typeAttribute = result.attributes?.find((attribute) => attribute.id === "type");
    expect(typeAttribute).toMatchObject({
      type: { kind: "enum" },
      editable: true,
    });
  });
});

// Workspace badge payloads got long enough to need their own describe block.
describe("runTicketsQuery workspace badges", () => {
  test("exposes linked workspaces as a displayable workspace badge payload", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ id: "ticket-1", shorthand: "T-1", title: "Has workspaces" }));

    const result = await runTicketsQuery({
      storage,
      projectId: "proj-1",
      workspaces: [
        makeWorkspace({
          id: "workspace-1",
          name: "First attempt",
          workspace_shorthand: "T-1_A1",
          worktree_path: "/worktrees/T-1_A1",
          created_at: "2026-01-02T00:00:00.000Z",
        }),
        makeWorkspace({
          id: "workspace-2",
          name: "Latest attempt",
          workspace_shorthand: "T-1_A2",
          branch: "main",
          worktree_path: null,
          created_at: "2026-01-03T00:00:00.000Z",
        }),
        makeWorkspace({
          id: "workspace-other",
          name: "Other ticket",
          workspace_shorthand: "T-2_A1",
          anchors_json: [
            {
              type: "ticket",
              id: "ticket-2",
              label: "T-2",
              metadata: {
                shorthand: "T-2",
                resourceParent: { type: "view", viewId: "pstdio-planner.tickets" },
              },
            },
          ],
        }),
      ],
    });

    expect(result.attributes?.find((attribute) => attribute.id === "workspace")).toMatchObject({
      id: "workspace",
      type: { kind: "string" },
      displayable: true,
      display: { kind: "workspace-badge", itemsAttributeId: "workspaceItems" },
    });
    expect(result.rows[0]?.attributes.workspace).toBe("workspace-2");
    expect(result.rows[0]?.attributes.workspaceItems).toEqual([
      {
        id: "workspace-2",
        name: "Latest attempt",
        shorthand: "T-1_A2",
        type: "current_branch",
        createdAt: "2026-01-03T00:00:00.000Z",
        resourceParent: {
          type: "ticket",
          id: "ticket-1",
          label: "T-1 Has workspaces",
          metadata: {
            shorthand: "T-1",
            resourceParent: { type: "view", viewId: "pstdio-planner.tickets" },
          },
        },
      },
      {
        id: "workspace-1",
        name: "First attempt",
        shorthand: "T-1_A1",
        type: "worktree",
        createdAt: "2026-01-02T00:00:00.000Z",
        resourceParent: {
          type: "ticket",
          id: "ticket-1",
          label: "T-1 Has workspaces",
          metadata: {
            shorthand: "T-1",
            resourceParent: { type: "view", viewId: "pstdio-planner.tickets" },
          },
        },
      },
    ]);
  });

  test("adds canonical ticket parent edges to linked workspace badge payloads", async () => {
    const storage = createMemoryStorage();
    const parent = makeTicket({ id: "ticket-parent", shorthand: "T-1", title: "Parent" });
    const child = makeTicket({
      id: "ticket-child",
      shorthand: "T-2",
      title: "Child",
      parentId: parent.id,
      sortOrder: 1,
    });
    await putTicket(storage, parent);
    await putTicket(storage, child);

    const result = await runTicketsQuery({
      storage,
      projectId: "proj-1",
      workspaces: [
        makeWorkspace({
          id: "workspace-1",
          name: "Child attempt",
          workspace_shorthand: "T-2_A1",
          anchors_json: [
            { type: "ticket", id: child.id, label: child.shorthand, metadata: { shorthand: child.shorthand } },
          ],
        }),
      ],
    });

    const childRow = result.rows.find((row) => row.id === child.id);
    expect(childRow?.attributes.workspaceItems).toEqual([
      expect.objectContaining({
        id: "workspace-1",
        resourceParent: {
          type: "ticket",
          id: child.id,
          label: "T-2 Child",
          metadata: {
            shorthand: "T-2",
            resourceParent: {
              type: "ticket",
              id: parent.id,
              label: "T-1 Parent",
              metadata: {
                shorthand: "T-1",
                resourceParent: { type: "view", viewId: "pstdio-planner.tickets" },
              },
            },
          },
        },
      }),
    ]);
  });

  test("falls back workspace badge labels to shorthand and then id", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ id: "ticket-1", shorthand: "T-1" }));

    const result = await runTicketsQuery({
      storage,
      projectId: "proj-1",
      workspaces: [
        makeWorkspace({ id: "workspace-1", name: undefined, workspace_shorthand: "T-1_A1" }),
        makeWorkspace({
          id: "workspace-2",
          name: undefined,
          workspace_shorthand: undefined,
          created_at: "2026-01-04T00:00:00.000Z",
        }),
      ],
    });

    expect(result.rows[0]?.attributes.workspaceItems).toEqual([
      expect.objectContaining({ id: "workspace-2", name: "workspace-2" }),
      expect.objectContaining({ id: "workspace-1", name: "T-1_A1" }),
    ]);
  });
});

describe("runTicketsQuery archive filtering", () => {
  test.each([
    ["missing filters", undefined, ["Active"]],
    ["empty archive selection", { archived: [] }, ["Active"]],
    ["active only", { archived: ["active"] }, ["Active"]],
    ["archived only", { archived: ["archived"] }, ["Archived"]],
    ["active and archived", { archived: ["active", "archived"] }, ["Active", "Archived"]],
  ])("filters archive state for %s", async (_name, filters, expectedTitles) => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await putTicket(storage, makeTicket({ shorthand: "T-1", title: "Active", archived: false, sortOrder: 0 }));
    await putTicket(storage, makeTicket({ shorthand: "T-2", title: "Archived", archived: true, sortOrder: 1 }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1", filters });

    expect(result.rows.map((row) => row.title)).toEqual(expectedTitles);
  });
});

describe("runTicketsQuery ordering and hierarchy", () => {
  test("orders rows by sortOrder", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ shorthand: "T-late", sortOrder: 5 }));
    await putTicket(storage, makeTicket({ shorthand: "T-early", sortOrder: 1 }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    expect(result.rows.map((row) => row.attributes.id)).toEqual(["T-early", "T-late"]);
  });

  test("returns ancestry labels and immediate parent filter values", async () => {
    const storage = createMemoryStorage();
    const root = makeTicket({ id: "root", shorthand: "T-1", sortOrder: 0 });
    const child = makeTicket({ id: "child", shorthand: "T-2", parentId: root.id, sortOrder: 1 });
    const grandchild = makeTicket({ id: "grandchild", shorthand: "T-3", parentId: child.id, sortOrder: 2 });
    await putTicket(storage, root);
    await putTicket(storage, child);
    await putTicket(storage, grandchild);

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    expect(result.rows.map((row) => row.attributes)).toEqual([
      expect.objectContaining({ id: "T-1", parent: "" }),
      expect.objectContaining({ id: "T-1 / T-2", parent: "T-1" }),
      expect.objectContaining({ id: "T-1 / T-2 / T-3", parent: "T-2" }),
    ]);
  });
});
