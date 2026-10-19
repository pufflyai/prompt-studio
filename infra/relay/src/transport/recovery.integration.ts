import { afterAll, beforeAll, expect, test } from "bun:test";
import { fingerprint, type Mutation, type Receipt, relayPath } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { sealStoredMutation } from "../storage/mutation.fixture";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
const sealMutation = (body: Parameters<typeof sealStoredMutation>[0]) =>
  sealStoredMutation(body, fixture.relayDatabaseUrl);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("current authority verifies retained proof but fences old epoch operations after restore", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  try {
    const owner = context.storage.owner(context.scope);
    const backup = await owner.snapshot();
    const grant = await context.manager.register({
      requestId: "recovering-environment",
      accountId: context.scope.accountId,
      workbenchId: context.scope.workbenchId,
      environmentId: "recovery-peer",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const access = await context.issue(grant.token!);
    const request = (operation: string, token: string, body?: unknown) =>
      fetch(new URL(`${relayPath(context.scope, "submit").replace(/submit$/, "")}${operation}`, server.url), {
        method: operation === "snapshot" ? "GET" : "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const mutation = await sealMutation({
      protocolVersion: 2,
      scope: context.scope,
      environmentId: context.environmentId,
      operationId: "original",
      parents: [],
      changes: [
        {
          recordId: "note",
          expectedRevision: 0,
          baseDeleted: false,
          value: { expected: await fingerprint(null), next: "saved" },
        },
      ],
    });
    const accepted = await request("submit", context.token, mutation);
    expect(accepted.status).toBe(200);
    await accepted.body?.cancel();
    // Recovery evidence also arrives through pull after the original response is lost.
    const snapshot = (await (await request("snapshot", access.token)).json()) as {
      receipts: Record<string, Receipt & { recoveryProof?: string }>;
    };
    const proof = snapshot.receipts.original.recoveryProof;
    await owner.restore(backup);
    expect((await request("submit", access.token, mutation)).status).toBe(403);
    const recovered = await request("recover", access.token, { mutation, proof });
    expect(recovered.status).toBe(409);
    await recovered.body?.cancel();
    expect((await owner.snapshot()).records).toEqual(backup.records);
    const { fingerprint: _digest, ...original } = mutation;
    const changes: Partial<Mutation>[] = [
      { operationId: "forged" },
      { environmentId: "forged" },
      { scope: { ...context.scope, extensionId: "other" } },
      { changes: [{ ...mutation.changes[0], value: { expected: await fingerprint(null), next: "forged" } }] },
    ];
    for (const change of changes) {
      const forged = await sealMutation({ ...original, ...change });
      expect((await request("recover", access.token, { mutation: forged, proof })).status).toBe(403);
    }
    expect((await request("recover", access.token, { mutation, proof: "0".repeat(64) })).status).toBe(403);
    expect((await request("recover", "invalid-access", { mutation, proof })).status).toBe(401);
  } finally {
    await server.stop(true);
    await context.close();
  }
});

test("pending and conflicting ancestors carry durable replay proof without implying acceptance", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  try {
    const submit = async (operationId: string, parents: string[]) => {
      const mutation = await sealMutation({
        protocolVersion: 2,
        scope: context.scope,
        environmentId: context.environmentId,
        operationId,
        parents,
        changes: [
          {
            recordId: "note",
            expectedRevision: 0,
            baseDeleted: false,
            value: { expected: await fingerprint(null), next: operationId },
          },
        ],
      });
      const response = await fetch(new URL(relayPath(context.scope, "submit"), server.url), {
        method: "POST",
        headers: { authorization: `Bearer ${context.token}`, "content-type": "application/json" },
        body: JSON.stringify(mutation),
      });
      expect(response.status).toBe(200);
      return (await response.json()) as Receipt & { recoveryProof?: string };
    };
    expect((await submit("winner", [])).status).toBe("accepted");
    const conflict = await submit("branch", []);
    expect(conflict.status).toBe("conflict");
    expect(conflict.recoveryProof).toMatch(/^[0-9a-f]{64}$/);
    const pending = await submit("child", ["branch"]);
    expect(pending.status).toBe("pending");
    expect(pending.recoveryProof).toMatch(/^[0-9a-f]{64}$/);
  } finally {
    await server.stop(true);
    await context.close();
  }
});
