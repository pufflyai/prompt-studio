import { expect, test } from "bun:test";
import { makeWorkspace } from "./workspace-provider.test-fixture";
import { getAcceptedProviderOperation } from "./workspace-provider-accepted-operation";
import type { WorkspaceRecord } from "./workspace-provider-projection";
import { makeDeps } from "./workspace-provider-reconciliation.fixture";

test("does not replay a create superseded by cancellation", async () => {
  const workspace = makeWorkspace({
    provider_ref_json: null,
    provider_operation_id: "create-1",
    provider_operation_kind: "create",
  });
  const { deps, beginProviderOperation, updateProviderProjection } = makeDeps({}, workspace);
  await beginProviderOperation(workspace.id, { operationId: "cancel-1", kind: "cancel", state: "provisioning" });
  expect(await getAcceptedProviderOperation(deps, workspace as WorkspaceRecord)).toBeUndefined();
  expect(updateProviderProjection).not.toHaveBeenCalled();
});
