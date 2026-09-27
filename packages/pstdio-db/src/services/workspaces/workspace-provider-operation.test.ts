import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createWorkspacesDBService } from "./workspaces";

let close: () => Promise<void>;
let workspacesService: ReturnType<typeof createWorkspacesDBService>;
let projectId: string;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  const projectsService = createProjectsDBService(result.db);
  projectId = (await projectsService.create({ name: "prompt-studio" })).id;
  workspacesService = createWorkspacesDBService(result.db);
});

afterEach(async () => {
  await close?.();
});

describe("workspace provider operations", () => {
  test("atomically replaces a referenced pending create with a cleanup operation", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      provider_id: "example.remote",
      provider_state: "provisioning",
      provider_operation_id: "op-create",
      provider_operation_kind: "create",
    });
    await workspacesService.updateProviderProjection(ws.id, {
      provider_state: "provisioning",
      execution_kind: "remote",
      provider_ref_json: { version: 1, data: { remoteId: "remote-1" } },
      provider_capabilities_json: ws.provider_capabilities_json,
    });

    const pending = await workspacesService.beginProviderOperation(ws.id, {
      operationId: "op-cancel",
      kind: "cancel",
      state: "provisioning",
    });

    expect(pending).toMatchObject({ provider_operation_id: "op-cancel", provider_operation_kind: "cancel" });
  });

  test("rejects a create projection after a lifecycle operation takes ownership", async () => {
    const ws = await workspacesService.create({
      project_id: projectId,
      shorthand_base: "PS-1",
      provider_id: "example.remote",
      provider_state: "provisioning",
      provider_operation_id: "op-create",
      provider_operation_kind: "create",
    });
    await workspacesService.beginProviderOperation(ws.id, {
      operationId: "op-delete",
      kind: "delete",
      state: "deleting",
    });

    const updated = await workspacesService.updateProviderOperationProjection(ws.id, {
      operationId: "op-create",
      operationKind: "create",
      patch: {
        provider_state: "ready",
        execution_kind: "remote",
        provider_operation_id: null,
        provider_operation_kind: null,
        provider_capabilities_json: ws.provider_capabilities_json,
      },
    });

    expect(updated).toBeNull();
    expect(await workspacesService.get(ws.id)).toMatchObject({
      provider_state: "deleting",
      provider_operation_id: "op-create",
      provider_operation_kind: "delete",
    });
  });
});

test("attaching an initial provider cannot replace an active remote creation", async () => {
  const workspace = await workspacesService.createDefault({ project_id: projectId, name: "Default" });
  const first = await workspacesService.attachInitialProvider(workspace.id, {
    provider_id: "example.remote",
    provider_params_json: {},
    provider_operation_id: "first",
  });
  expect(first?.provider_operation_id).toBe("first");
  const second = await workspacesService.attachInitialProvider(workspace.id, {
    provider_id: "example.other",
    provider_params_json: {},
    provider_operation_id: "second",
  });
  expect(second).toBeNull();
  expect((await workspacesService.get(workspace.id))?.provider_operation_id).toBe("first");
});
