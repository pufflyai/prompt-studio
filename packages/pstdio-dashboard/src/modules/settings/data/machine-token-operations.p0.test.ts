import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { createMachineTokenOperations } from "./machine-token-operations";

test("retains only submission input when token issuance cannot be confirmed", async () => {
  const operations = getWorkbenchOperations(createScopedQueryClient({ runtimeId: "app", extensionId: "pstdio" }));
  const response = Promise.withResolvers<never>();
  let writes = 0;
  const api = {
    issueToken: () => {
      writes++;
      return response.promise;
    },
    listTokens: async () => ({ tokens: [] }),
    revokeToken: async () => {},
  };
  const first = createMachineTokenOperations(operations, api);
  const second = createMachineTokenOperations(operations, api);
  const input = { projectId: "a", name: "Agent", commandScopes: ["run"], expiresInSeconds: 60 };
  const sending = first.issue(input);
  expect(second.project("a")).toMatchObject({ issuing: true });
  response.reject(new PstdioConnectionError(new Error("Response lost")));
  await expect(sending).rejects.toThrow();
  expect(second.project("a")).toMatchObject({ issuing: false, unresolved: true, draft: input });
  expect(second.project("b").unresolved).toBe(false);
  await expect(second.issue(input)).rejects.toThrow("Review active tokens");
  expect(writes).toBe(1);
  expect(operations.getSnapshot().recovery[0]).toMatchObject({ draft: input, canCheck: false });
});

test("keeps only the targeted token hidden while revocation is pending and restores it on rejection", async () => {
  const operations = getWorkbenchOperations(createScopedQueryClient({ runtimeId: "app", extensionId: "pstdio" }));
  const response = Promise.withResolvers<void>();
  const actions = createMachineTokenOperations(operations, {
    issueToken: async () => {
      throw new Error("Unexpected token issuance");
    },
    listTokens: async () => ({ tokens: [] }),
    revokeToken: () => response.promise,
  });
  const revoking = actions.revoke("a", "token-3", () => {});
  expect(actions.project("a").revokingIds).toEqual(new Set(["token-3"]));
  expect(actions.project("b").revokingIds.size).toBe(0);
  response.reject(new Error("Revocation rejected"));
  await expect(revoking).rejects.toThrow("Revocation rejected");
  expect(actions.project("a").revokingIds.size).toBe(0);
});
