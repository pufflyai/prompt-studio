import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  fingerprint,
  receiptSchema,
  relayReplayResultSchema,
  sealMutation,
  snapshotSchema,
} from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("real HTTP groups retain duplicate receipts and contiguous replay", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const base = `/v1/workbenches/~${context.scope.workbenchId}/extensions/~notes/`;
  const request = (path: string, body?: unknown) =>
    fetch(new URL(base + path, server.url), {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${context.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    const initial = snapshotSchema.parse(await (await request("snapshot")).json());
    const mutation = await sealMutation({
      protocolVersion: 1,
      scope: context.scope,
      environmentId: context.environmentId,
      operationId: "create",
      parents: [],
      changes: [
        {
          recordId: "note",
          expectedRevision: 0,
          baseDeleted: false,
          value: { expected: await fingerprint(null), next: "network saved" },
        },
      ],
    });
    const submitted = await request("submit", mutation);
    expect(submitted.status).toBe(200);
    const receipt = receiptSchema.parse(await submitted.json());
    expect(receipt.status).toBe("accepted");
    expect(await (await request("submit", mutation)).json()).toEqual(receipt);
    const replay = relayReplayResultSchema.parse(await (await request("replay", initial.checkpoint)).json());
    expect(replay.status).toBe("replay");
    if (replay.status !== "replay") throw new Error("Expected replay");
    expect(replay.batch.groups).toEqual([receipt]);
    expect(snapshotSchema.parse(await (await request("snapshot")).json()).records.note!.value).toBe("network saved");
  } finally {
    await server.stop(true);
    await context.close();
  }
});

test("current authority rejects foreign mutations and invalid scope registration", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const base = `/v1/workbenches/~${context.scope.workbenchId}/extensions/~notes/`;
  const call = (path: string, token: string | null, body?: unknown) =>
    fetch(new URL(path, server.url), {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(token ? { authorization: token } : {}), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    const denied = await call(`${base}snapshot`, null);
    expect(denied.status).toBe(401);
    expect(denied.headers.get("www-authenticate")).toBe('Bearer realm="relay"');
    expect(denied.headers.get("cache-control")).toBe("no-store");
    expect((await call(`${base}snapshot`, `bEaReR   ${context.token}`)).status).toBe(200);
    for (const claims of [
      { scope: { ...context.scope, accountId: "foreign" }, environmentId: context.environmentId },
      { scope: { ...context.scope, workbenchId: "foreign" }, environmentId: context.environmentId },
      { scope: { ...context.scope, extensionId: "foreign" }, environmentId: context.environmentId },
      { scope: context.scope, environmentId: "foreign" },
    ]) {
      const mutation = await sealMutation({
        protocolVersion: 1,
        ...claims,
        operationId: "forged",
        parents: [],
        changes: [{ recordId: "note", expectedRevision: 0, baseDeleted: false, deleted: true }],
      });
      expect((await call(`${base}submit`, `Bearer ${context.token}`, mutation)).status).toBe(403);
    }
    const unknown = base.replace("/~notes/", "/~unknown/");
    expect((await call(`${unknown}snapshot`, `Bearer ${context.token}`)).status).toBe(409);
    expect((await call(`${unknown}initialize`, `Bearer ${context.token}`, {})).status).toBe(400);
    expect((await call(`${unknown}snapshot`, `Bearer ${context.token}`)).status).toBe(409);
    expect((await context.storage.owner(context.scope).snapshot()).records).toEqual({});
    await context.manager.removeDevice({ accountId: context.scope.accountId, deviceId: context.environmentId });
    await expect(context.renew()).rejects.toThrow("Environment access unavailable");
    expect((await call(`${base}snapshot`, `Bearer ${context.token}`)).status).toBe(200);
  } finally {
    await server.stop(true);
    await context.close();
  }
});
