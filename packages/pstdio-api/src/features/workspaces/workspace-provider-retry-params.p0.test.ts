import { expect, test } from "bun:test";
import { makeWorkspace } from "./workspace-provider.test-fixture";
import type { WorkspaceRecord } from "./workspace-provider-projection";
import { makeDeps } from "./workspace-provider-reconciliation.fixture";
import { persistRetryParams } from "./workspace-provider-retry-params";

test("does not overwrite a cancellation while resolving creation params", async () => {
  const workspace = makeWorkspace({
    provider_ref_json: null,
    provider_operation_id: "create-1",
    provider_operation_kind: "create",
  });
  const { deps, beginProviderOperation, updateProviderProjection } = makeDeps({}, workspace);
  await beginProviderOperation(workspace.id, { operationId: "cancel-1", kind: "cancel", state: "provisioning" });
  expect(
    await persistRetryParams(deps, workspace as WorkspaceRecord, {
      context: {} as never,
      provider: { params: { repository: { type: "text" } } } as never,
    }),
  ).toBeNull();
  expect(updateProviderProjection).not.toHaveBeenCalled();
});
