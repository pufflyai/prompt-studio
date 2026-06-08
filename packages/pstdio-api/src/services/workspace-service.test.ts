import { describe, expect, mock, test } from "bun:test";
import { createWorkspaceService } from "./workspace-service";

const buildDeps = () => {
  const workspacesDb = {
    create: mock(async (input: Record<string, unknown>) => ({
      id: "ws_1",
      project_id: input.project_id,
    })),
    archive: mock(async (id: string) => ({
      id,
      project_id: "project_1",
      archived: true,
    })),
    softDelete: mock(async (_id: string) => {}),
    rename: mock(async (id: string, name: string) => ({
      id,
      project_id: "project_1",
      name,
    })),
    get: mock(async () => null),
    getByShorthand: mock(async () => null),
    list: mock(async () => []),
    setInitializing: mock(async () => null),
    setSetupError: mock(async () => null),
    setStartupLogFileId: mock(async () => {}),
    updateGitMetadata: mock(async () => null),
  };

  const emitted: unknown[][] = [];
  const eventBus = { emit: (...args: unknown[]) => emitted.push(args) };

  return {
    deps: {
      workspacesDb,
      eventBus,
      reposService: { listByProject: mock(async () => []) },
    } as unknown as Parameters<typeof createWorkspaceService>[0],
    workspacesDb,
    emitted,
  };
};

describe("WorkspaceService", () => {
  describe("create", () => {
    test("creates workspace and emits event", async () => {
      const { deps, workspacesDb, emitted } = buildDeps();
      const service = createWorkspaceService(deps);

      const input = { project_id: "p1", shorthand_base: "T-1" };
      const result = await service.create(input);

      expect(result).toMatchObject({ id: "ws_1" });
      expect(workspacesDb.create).toHaveBeenCalledWith(input);
      expect(emitted).toContainEqual(["workspaces", "set", expect.objectContaining({ id: "ws_1" })]);
    });
  });

  describe("archive", () => {
    test("archives workspace and emits event", async () => {
      const { deps, workspacesDb, emitted } = buildDeps();
      const service = createWorkspaceService(deps);

      const result = await service.archive("ws_1");

      expect(result).toMatchObject({ id: "ws_1", archived: true });
      expect(workspacesDb.archive).toHaveBeenCalledWith("ws_1");
      expect(emitted).toContainEqual(["workspaces", "set", expect.objectContaining({ id: "ws_1", archived: true })]);
    });

    test("returns null when workspace not found", async () => {
      const { deps, workspacesDb, emitted } = buildDeps();
      (workspacesDb.archive as ReturnType<typeof mock>).mockImplementation(async () => null);
      const service = createWorkspaceService(deps);

      const result = await service.archive("missing");
      expect(result).toBeNull();
      expect(emitted).toHaveLength(0);
    });
  });

  describe("softDelete", () => {
    test("soft-deletes and emits delete event", async () => {
      const { deps, workspacesDb, emitted } = buildDeps();
      const service = createWorkspaceService(deps);

      await service.softDelete("ws_1");

      expect(workspacesDb.softDelete).toHaveBeenCalledWith("ws_1");
      expect(emitted).toContainEqual(["workspaces", "delete", { id: "ws_1" }]);
    });
  });

  describe("rename", () => {
    test("renames workspace and emits event", async () => {
      const { deps, workspacesDb, emitted } = buildDeps();
      const service = createWorkspaceService(deps);

      const result = await service.rename("ws_1", "Spike - API only");

      expect(result).toMatchObject({ id: "ws_1", name: "Spike - API only" });
      expect(workspacesDb.rename).toHaveBeenCalledWith("ws_1", "Spike - API only");
      expect(emitted).toContainEqual([
        "workspaces",
        "set",
        expect.objectContaining({ id: "ws_1", name: "Spike - API only" }),
      ]);
    });

    test("returns null without emitting when workspace is missing", async () => {
      const { deps, workspacesDb, emitted } = buildDeps();
      (workspacesDb.rename as ReturnType<typeof mock>).mockImplementation(async () => null);
      const service = createWorkspaceService(deps);

      const result = await service.rename("missing", "Spike - API only");

      expect(result).toBeNull();
      expect(emitted).toHaveLength(0);
    });
  });
});
