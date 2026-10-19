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
