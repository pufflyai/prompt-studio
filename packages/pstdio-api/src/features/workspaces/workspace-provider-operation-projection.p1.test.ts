import { expect, test } from "bun:test";
import { createDb, createProjectsDBService, createWorkspacesDBService } from "pstdio-db";
import { updateCreateProjection } from "./workspace-provider-operation-projection";

test.each([
  "disable",
  "cancel",
  "forget",
] as const)("late create admission preserves a concurrent %s", async (action) => {
  const db = await createDb({ path: ":memory:" });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let updating: ReturnType<typeof updateCreateProjection> | undefined;
  try {
    const projects = createProjectsDBService(db.db);
    const service = createWorkspacesDBService(db.db);
    const project = await projects.create({ name: "Provider admission" });
    const workspace = await service.createStandalone({
      project_id: project.id,
      provider_id: "example.provider.workspace-type.remote",
      provider_state: "provisioning",
      provider_operation_id: "accepted-create",
      provider_operation_kind: "create",
    });
    let available = true;
    let writes = 0;
    const deps = {
      workspaceService: {
        ...service,
        async updateProviderOperationProjection(...args: Parameters<typeof service.updateProviderOperationProjection>) {
          if (action === "forget" && writes > 0) throw new Error("A forgotten create was re-admitted");
          if (++writes === 1) {
            entered.resolve();
            await release.promise;
          }
          return service.updateProviderOperationProjection(...args);
        },
      },
      workspaceProviderRuntime: { find: async () => (available ? { context: {}, provider: {} } : undefined) },
    } as never;
    const providerRef = { version: 1, data: { remoteId: "accepted-resource" } };
    updating = updateCreateProjection(deps, workspace, "accepted-create", {
      provider_state: "ready",
      provider_ref_json: providerRef,
      provider_operation_id: null,
      provider_operation_kind: null,
    });
    await entered.promise;
    if (action === "disable") {
      available = false;
      await service.updateProviderProjection(workspace.id, { provider_state: "provider_missing" });
    } else if (action === "forget") {
      available = false;
      await service.updateProviderProjection(workspace.id, {
        provider_state: "provider_missing",
        execution_kind: "remote",
        root_path: null,
      });
      expect(await service.softDelete(workspace.id, { forget: true })).not.toBeNull();
    } else {
      await service.beginProviderOperation(workspace.id, {
        operationId: "cancel",
        kind: "cancel",
        state: "provisioning",
      });
    }
    release.resolve();
    await updating;
    const expected = {
      disable: {
        provider_state: "provider_missing",
        provider_ref_json: providerRef,
        provider_operation_id: "accepted-create",
        provider_operation_kind: "create",
      },
      cancel: {
        provider_state: "provisioning",
        provider_operation_id: "accepted-create",
        provider_operation_kind: "cancel",
      },
      forget: { deleted_at: expect.any(String), provider_state: "provider_missing", provider_ref_json: null },
    };
    expect(await service.get(workspace.id)).toMatchObject(expected[action]);
  } finally {
    release.resolve();
    await updating?.catch(() => {});
    await db.close();
  }
});
