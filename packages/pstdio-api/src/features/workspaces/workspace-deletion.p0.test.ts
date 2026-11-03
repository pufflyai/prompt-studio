import { expect, test } from "bun:test";
import { createWorkspacesApi } from "../extensions/command-environment/workspaces";
import { deleteWorkspaceHandler } from "./endpoints/delete-workspace";
import { deleteWorkspace } from "./workspace-deletion";
import { makeWorkspace } from "./workspace-provider.test-fixture";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("forgetting an orphan stops active sessions and archives its history without calling a provider", async () => {
  const workspace = makeWorkspace({ provider_state: "provider_missing", provider_ref_json: null });
  const events: string[] = [];
  const deps = {
    workspaceService: {
      get: async () => workspace,
      softDelete: async () => {
        events.push("delete record");
        return true;
      },
    },
    workspaceSessionService: {
      listByWorkspace: async () => [
        { id: "running", status: "in_progress", archived: false },
        { id: "done", status: "completed", archived: false },
      ],
    },
    sessionService: {
      cancel: async (id: string) => {
        events.push(`cancel ${id}`);
      },
      archive: async (id: string) => {
        events.push(`archive ${id}`);
      },
    },
  } as never;

  await deleteWorkspace(deps, workspace as never, { forget: true });

  expect(events).toEqual(["delete record", "cancel running", "archive running", "archive done"]);
});

test("forgetting rechecks the latest workspace and preserves a recovered provider reference", async () => {
  const old = makeWorkspace({ provider_state: "provider_missing", provider_ref_json: null });
  const current = makeWorkspace();
  let deleted = false;
  const deps = {
    workspaceService: {
      get: async () => current,
      softDelete: async () => {
        deleted = true;
      },
    },
  } as never;

  await expect(deleteWorkspace(deps, old as never, { forget: true })).rejects.toThrow(/no backing reference/);
  expect(deleted).toBe(false);
});

test.each(["cancel", "archive"])("forget retries unfinished session cleanup after a %s failure", async (phase) => {
  let workspace = {
    ...makeWorkspace({ provider_state: "provider_missing", provider_ref_json: null }),
    deleted_at: null as string | null,
  };
  const sessions = [
    { id: "active", status: "in_progress", archived: false },
    { id: "completed", status: "completed", archived: false },
  ];
  let deleted = 0;
  let failed = false;
  const deps = {
    workspaceService: {
      get: async () => workspace,
      softDelete: async () => {
        deleted++;
        workspace = { ...workspace, deleted_at: "2026-11-03T23:00:00.000Z" };
        return true;
      },
    },
    workspaceSessionService: { listByWorkspace: async () => sessions },
    sessionService: {
      cancel: async (id: string) => {
        if (phase === "cancel" && !failed) {
          failed = true;
          throw new Error("temporary cancel failure");
        }
        sessions.find((session) => session.id === id)!.status = "cancelled";
      },
      archive: async (id: string) => {
        if (phase === "archive" && !failed) {
          failed = true;
          throw new Error("temporary archive failure");
        }
        sessions.find((session) => session.id === id)!.archived = true;
      },
    },
  } as never;

  await expect(deleteWorkspace(deps, workspace as never, { forget: true })).rejects.toThrow(
    `temporary ${phase} failure`,
  );
  await deleteWorkspace(deps, workspace as never, { forget: true });

  expect(deleted).toBe(1);
  expect(sessions[0].status).toBe("cancelled");
  expect(sessions.every((session) => session.archived)).toBe(true);
});

test.each([
  true,
  false,
])("overlapping requests cannot inherit a different deletion mode, forget first=%s", async (forgetFirst) => {
  const started = deferred();
  const release = deferred();
  const workspace = makeWorkspace({ provider_state: "provider_missing", provider_ref_json: null });
  let providerCalls = 0;
  const deps = {
    workspaceService: {
      get: async () => workspace,
      softDelete: async () => true,
    },
    workspaceSessionService: {
      listByWorkspace: async () => {
        started.resolve();
        await release.promise;
        return [];
      },
    },
  } as never;
  const providerDelete = async () => {
    providerCalls++;
    started.resolve();
    await release.promise;
    return false;
  };
  const first = deleteWorkspace(deps, workspace as never, {
    forget: forgetFirst,
    deleteProviderBackedWorkspace: providerDelete,
  });
  await started.promise;
  const second = deleteWorkspace(deps, workspace as never, {
    forget: !forgetFirst,
    deleteProviderBackedWorkspace: providerDelete,
  }).then(
    () => null,
    (error: Error) => error.message,
  );
  release.resolve();
  await first;

  expect(await second).toMatch(/different.*mode/i);
  expect(providerCalls).toBe(forgetFirst ? 0 : 1);
});

test("HTTP and extension deletions across projects share two slots through session archival", async () => {
  const release = deferred();
  const slotsStarted = deferred();
  const entered: string[] = [];
  const archived: string[] = [];
  const deleted: string[] = [];
  const workspaces = Array.from({ length: 28 }, (_, index) =>
    makeWorkspace({ id: `ws-${index}`, project_id: index % 2 === 0 ? "project-a" : "project-b" }),
  );
  let active = 0;
  let peak = 0;
  const deps = {
    workspaceService: {
      get: async (id: string) => workspaces.find((workspace) => workspace.id === id),
      beginProviderOperation: async (id: string, operation: { operationId: string; kind: string }) => ({
        ...workspaces.find((workspace) => workspace.id === id),
        provider_operation_id: operation.operationId,
        provider_operation_kind: operation.kind,
      }),
      softDelete: async (id: string) => {
        deleted.push(id);
        active--;
      },
    },
    workspaceSessionService: { listByWorkspace: async (id: string) => [{ id, status: "completed", archived: false }] },
    sessionService: {
      archive: async (id: string) => {
        await release.promise;
        archived.push(id);
      },
    },
    workspaceProviderRuntime: {
      find: async () => ({
        context: {},
        provider: {
          delete: async (_ctx: unknown, input: { workspaceId: string }) => {
            entered.push(input.workspaceId);
            active++;
            peak = Math.max(peak, active);
            if (entered.length === 2) slotsStarted.resolve();
          },
        },
      }),
    },
  } as never;
  const extension = createWorkspacesApi(deps, { projectId: workspaces[0].project_id }, {} as never);
  const http = deleteWorkspaceHandler(deps);
  const tasks = workspaces.map((workspace, index) =>
    index % 2 === 0
      ? extension.delete(workspace.id)
      : http({ req: { valid: () => ({ id: workspace.id }) }, json: (body: unknown) => body } as never, async () => {}),
  );
  const complete = Promise.all(tasks);
  try {
    await slotsStarted.promise;
    // Allow every caller to reach the queue while the first two wait on archival.
    await new Promise<void>((done) => setImmediate(done));
    expect(entered).toHaveLength(2);
    expect(deleted).toEqual([]);
  } finally {
    release.resolve();
    await complete;
  }
  expect(peak).toBe(2);
  expect(archived.sort()).toEqual(workspaces.map((workspace) => workspace.id).sort());
  expect(deleted.sort()).toEqual(archived);
});

test("duplicate deletions share cleanup and publish the removed event once", async () => {
  const release = deferred();
  const started = deferred();
  const workspace = makeWorkspace({ root_path: "/managed/workspace" });
  let removals = 0;
  let finalizations = 0;
  let events = 0;
  const deps = {
    workspaceService: {
      softDelete: async () => {
        finalizations++;
      },
    },
    workspaceSessionService: { listByWorkspace: async () => [] },
  } as never;
  const overrides = {
    deleteProviderBackedWorkspace: async () => {
      removals++;
      started.resolve();
      await release.promise;
      return true;
    },
    fireExtensionEventAsync: () => {
      events++;
    },
  };
  const first = deleteWorkspace(deps, workspace as never, overrides);
  const second = deleteWorkspace(deps, workspace as never, overrides);
  try {
    await started.promise;
    expect(first).toBe(second);
    expect(removals).toBe(1);
  } finally {
    release.resolve();
    await Promise.all([first, second]);
  }
  expect(finalizations).toBe(1);
  expect(events).toBe(1);
});

test("failed deletions release both slots, preserve rows, and allow retry", async () => {
  const deleted: string[] = [];
  const deps = {
    workspaceService: {
      softDelete: async (id: string) => {
        deleted.push(id);
      },
    },
    workspaceSessionService: { listByWorkspace: async () => [] },
  } as never;
  const failed = makeWorkspace({ id: "failed" });
  const second = makeWorkspace({ id: "second" });
  const success = makeWorkspace({ id: "success" });
  const fail = {
    deleteProviderBackedWorkspace: async () => {
      throw new Error("Cannot remove");
    },
  };
  const pass = { deleteProviderBackedWorkspace: async () => false };
  const results = await Promise.allSettled([
    deleteWorkspace(deps, failed as never, fail),
    deleteWorkspace(deps, second as never, fail),
    deleteWorkspace(deps, success as never, pass),
  ]);
  expect(results.map((result) => result.status)).toEqual(["rejected", "rejected", "fulfilled"]);
  expect(deleted).toEqual(["success"]);
  await deleteWorkspace(deps, failed as never, pass);
  expect(deleted).toEqual(["success", "failed"]);
});
