import { expect, test } from "bun:test";
import type { AutomationTokenRecord } from "@pstdio/sdk/api";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { acceptMachineTokenRevocation, createMachineTokenOperations } from "./machine-token-operations";

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

test("a late token-list read cannot restore a separately revoked token", async () => {
  const operations = getWorkbenchOperations(createScopedQueryClient({ runtimeId: "app", extensionId: "pstdio" }));
  const token = (id: string): AutomationTokenRecord => ({
    id,
    name: id,
    principalId: "principal",
    projectId: "a",
    tokenPrefix: "prefix",
    commandScopes: [],
    createdAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-01-01T00:00:00Z",
    lastUsedAt: null,
    revokedAt: null,
  });
  const first = token("first");
  const second = token("second");
  const timestamp = "2026-01-02T00:00:00Z";
  const stale = { tokens: [{ ...first, revokedAt: timestamp }, second] };
  const latest = {
    tokens: [
      { ...first, revokedAt: timestamp },
      { ...second, revokedAt: timestamp },
    ],
  };
  const firstRead = Promise.withResolvers<typeof stale>();
  const entered = Promise.withResolvers<void>();
  let cache = { tokens: [first, second] };
  let reads = 0;
  const actions = createMachineTokenOperations(operations, {
    issueToken: async () => {
      throw new Error("Unexpected issuance");
    },
    revokeToken: async () => {},
    listTokens: () => {
      if (++reads > 1) return Promise.resolve(latest);
      entered.resolve();
      return firstRead.promise;
    },
  });
  const revoke = (id: string) =>
    actions.revoke("a", id, (result) => {
      cache = acceptMachineTokenRevocation(cache, result, id);
    });
  const one = revoke(first.id);
  await entered.promise;
  await revoke(second.id);
  firstRead.resolve(stale);
  await one;
  expect(cache).toEqual(latest);
});
