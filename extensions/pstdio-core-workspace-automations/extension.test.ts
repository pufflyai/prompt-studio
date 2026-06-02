import { describe, expect, test } from "bun:test";
import extension from "./extension";

const createStorage = () => {
  const collections = new Map<string, Map<string, unknown>>();
  const values = new Map<string, unknown>();

  return {
    async get(key: string) {
      return values.get(key);
    },
    async set(key: string, value: unknown) {
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    },
    collection(name: string) {
      const items = collections.get(name) ?? new Map<string, unknown>();
      collections.set(name, items);

      return {
        async get(id: string) {
          return items.get(id);
        },
        async list() {
          return [...items.values()];
        },
        async put(id: string, value: unknown) {
          items.set(id, value);
        },
        async create(value: unknown) {
          const id = `created-${items.size + 1}`;
          const item = typeof value === "object" && value !== null ? { ...value, id } : { id };
          items.set(id, item);
          return item;
        },
        async delete(id: string) {
          items.delete(id);
        },
      };
    },
  };
};

describe("pstdio-core-workspace-automations", () => {
  test("mounts workspace-scoped actions in workbench top actions", () => {
    expect(extension.commands?.runReview?.menus).toEqual([
      {
        target: "workbench.nav.actions",
        label: "Run review",
        when: { resourceType: ["workspace"] },
      },
    ]);
  });

  test("contributes a project settings panel for workspace statuses", () => {
    const panel = extension.settingsPanels?.workspaceStatuses;

    expect(panel).toMatchObject({
      title: "Workspace statuses",
      target: "workbench.settings",
      scope: "project",
      webview: expect.objectContaining({
        capabilities: ["commands.execute"],
      }),
    });
  });

  test("workspaceStatus.read returns default status definitions from extension storage", async () => {
    const storage = createStorage();

    const result = await extension.commands?.["workspaceStatus.read"]?.run({
      params: { workspaceIds: ["workspace-1"] },
      storage,
    } as never);

    expect(result).toMatchObject({
      attribute: {
        id: "status",
        label: "Status",
        kind: "enum",
        filterable: true,
        groupable: true,
        displayable: true,
        sortable: true,
        editable: true,
      },
      defaultSettings: {
        viewMode: "board",
        columnGrouping: "status",
      },
    });
    expect(result?.statuses.map((status) => status.id)).toEqual([
      "wip",
      "blocked",
      "review-ready",
      "reviewed",
      "changes-requested",
    ]);
    expect(result?.valuesByWorkspaceId).toEqual({});
  });

  test("workspaceStatus.set writes per-workspace status values to extension storage", async () => {
    const storage = createStorage();

    await extension.commands?.["workspaceStatus.set"]?.run({
      params: { workspaceId: "workspace-1", status: "review-ready" },
      storage,
    } as never);

    const result = await extension.commands?.["workspaceStatus.read"]?.run({
      params: { workspaceIds: ["workspace-1", "workspace-2"] },
      storage,
    } as never);

    expect(result?.valuesByWorkspaceId).toMatchObject({
      "workspace-1": {
        status: "review-ready",
      },
    });
    expect(result?.valuesByWorkspaceId).not.toHaveProperty("workspace-2");
  });

  test("workspaceStatus.set exposes the moved workspace status CLI command", () => {
    expect(extension.commands?.["workspaceStatus.set"]?.cli).toMatchObject({
      globalAliases: [["workspaces", "set-status"]],
    });
  });

  test("workspaceStatus.set resolves workspace shorthand before storing the status", async () => {
    const storage = createStorage();

    await extension.commands?.["workspaceStatus.set"]?.run({
      params: { workspace: "PS-1_A1", status: "review-ready" },
      projectId: "project-1",
      storage,
      workspaces: {
        getByShorthand: async () => ({ id: "workspace-1" }),
      },
    } as never);

    const result = await extension.commands?.["workspaceStatus.read"]?.run({
      params: { workspaceIds: ["workspace-1"] },
      storage,
    } as never);

    expect(result?.valuesByWorkspaceId).toHaveProperty("workspace-1");
  });

  test("workspaceStatus.delete removes a status definition without touching legacy attempt statuses", async () => {
    const storage = createStorage();

    await extension.commands?.["workspaceStatus.delete"]?.run({
      params: { statusId: "blocked" },
      storage,
    } as never);
    const result = await extension.commands?.["workspaceStatus.read"]?.run({
      params: { workspaceIds: [] },
      storage,
    } as never);

    expect(result?.statuses.map((status) => status.id)).not.toContain("blocked");
  });

  test("workspaceStatus.delete does not recreate defaults after all definitions are removed", async () => {
    const storage = createStorage();
    const initial = await extension.commands?.["workspaceStatus.read"]?.run({
      params: { workspaceIds: [] },
      storage,
    } as never);

    for (const status of initial?.statuses ?? []) {
      await extension.commands?.["workspaceStatus.delete"]?.run({
        params: { statusId: status.id },
        storage,
      } as never);
    }
    const result = await extension.commands?.["workspaceStatus.read"]?.run({
      params: { workspaceIds: [] },
      storage,
    } as never);

    expect(result?.statuses).toEqual([]);
  });

  test("workspaceStatus.update can clear a status icon", async () => {
    const storage = createStorage();

    await extension.commands?.["workspaceStatus.update"]?.run({
      params: { statusId: "wip", icon: "clock" },
      storage,
    } as never);
    await extension.commands?.["workspaceStatus.update"]?.run({
      params: { statusId: "wip", icon: null },
      storage,
    } as never);
    const result = await extension.commands?.["workspaceStatus.read"]?.run({
      params: { workspaceIds: [] },
      storage,
    } as never);

    expect(result?.statuses.find((status) => status.id === "wip")?.icon).toBeNull();
  });

  test("runReview uses the workspace resource when launched from the dashboard", async () => {
    const sessions: unknown[] = [];

    await extension.commands?.runReview?.run({
      params: {},
      resource: {
        type: "workspace",
        id: "workspace-1",
        label: "PS-304_A1",
        metadata: { ticket: "PS-304" },
      },
      sessions: {
        create: async (input: unknown) => {
          sessions.push(input);
          return { id: "session-1" };
        },
      },
    } as never);

    expect(sessions).toEqual([
      {
        workspaceId: "workspace-1",
        title: "Code review: PS-304",
        harness: undefined,
        template: "review-code",
        vars: { ticket: "PS-304" },
      },
    ]);
  });
});
