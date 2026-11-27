import { expect, test } from "bun:test";
import { syncPath, syncProtocolHeader, syncProtocolVersion } from "pstdio-sync-contracts";
import { defaultRelayLimits } from "../limits";
import type { RelayOwners } from "./owners";
import { handleSyncRequest } from "./sync-http";

test("a team lease expires while an authenticated body is still arriving", async () => {
  const expiry = new Date(Date.now() + 100).toISOString();
  let reads = 0;
  const owners = {
    async verifyAccess() {
      return {
        accountId: "team",
        userId: "person",
        workbenchId: "project",
        environmentId: "device",
        expiresAt: expiry,
      };
    },
    allow: () => true,
    limits: defaultRelayLimits,
    sync: {
      projectAccess: {
        response: async (_key: string, _signal: AbortSignal, handle: () => Promise<Response>) => handle(),
      },
      documents: {
        read() {
          reads++;
          return {};
        },
      },
    },
  } as unknown as RelayOwners;
  const received = Promise.withResolvers<void>();
  const bytes = new TextEncoder().encode('{"after":');
  const request = new Request(
    new URL(
      syncPath({
        kind: "document",
        projectId: "project",
        documentId: "doc_01234567890123456789",
        spaceOwner: null,
        operation: "read",
      }),
      "https://relay.fixture.test",
    ).href,
    {
      method: "POST",
      headers: { authorization: "Bearer fixture", [syncProtocolHeader]: String(syncProtocolVersion) },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
        },
        cancel() {
          received.resolve();
        },
      }),
    } as RequestInit,
  );
  const response = await handleSyncRequest(
    owners,
    () => false,
    request,
    () => {},
  );
  expect(response?.status).toBe(401);
  await received.promise;
  expect(reads).toBe(0);
});
