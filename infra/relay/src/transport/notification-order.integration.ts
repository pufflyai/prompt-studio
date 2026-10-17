import { afterAll, beforeAll, expect, test } from "bun:test";
import { fingerprint, sealMutation } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { withFixtureDatabase } from "./database.fixture";
import { createTransportFixture } from "./integration-fixture";
import { connectSocket } from "./socket.fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("LISTEN precedes readiness and a pre-upgrade notification is retained", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  let release = await fixture.blockRelayData();
  const connection = connectSocket(server.url, context.scope, context.token);
  try {
    await fixture.waitForBlockedData();
    await withFixtureDatabase(fixture.relayDatabaseUrl, async (client) => {
      await client.query("BEGIN");
      await client.query("SELECT pg_notify('relay_scope_changed', $1)", [await fingerprint(context.scope)]);
      expect(connection.messages).toHaveLength(0);
      await client.query("COMMIT");
    });
    await release();
    release = async () => {};
    expect((await connection.next()).type).toBe("ready");
    expect((await connection.next()).type).toBe("changed");
  } finally {
    await release();
    connection.socket.close();
    await server.stop(true);
    await context.close();
  }
});

test("one hundred revision commits remain readable without any manager permission calls", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const connection = connectSocket(server.url, context.scope, context.token);
  try {
    expect((await connection.next()).type).toBe("ready");
    await context.stopAuthority();
    const owner = context.storage.owner(context.scope);
    let revision = "published-notes";
    for (let index = 0; index < 100; index++) {
      const next = `burst-${index}`;
      await owner.publishRevision(revision, next);
      revision = next;
    }
    expect((await connection.next()).type).toBe("changed");
    expect((await owner.snapshot()).publishedRevision).toBe("burst-99");
  } finally {
    connection.socket.close();
    await server.stop(true);
    await context.close();
  }
});

test("pending and conflicting receipt commits both notify; duplicates keep their receipt", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const connection = connectSocket(server.url, context.scope, context.token);
  try {
    expect((await connection.next()).type).toBe("ready");
    const owner = context.storage.owner(context.scope);
    const change = {
      recordId: "note",
      expectedRevision: 0,
      baseDeleted: false,
      value: { expected: await fingerprint(null), next: "first" },
    };
    const create = (operationId: string, parents: string[], next: string) =>
      sealMutation({
        protocolVersion: 1,
        scope: context.scope,
        environmentId: context.environmentId,
        operationId,
        parents,
        changes: [{ ...change, value: { ...change.value, next } }],
      });
    const pending = await owner.submit(await create("waiting", ["missing"], "pending"));
    expect(pending.status).toBe("pending");
    expect((await connection.next()).type).toBe("changed");
    const accepted = await owner.submit(await create("first", [], "first"));
    expect(accepted.status).toBe("accepted");
    expect((await connection.next()).type).toBe("changed");
    const mutation = await create("stale", [], "alternative");
    const conflict = await owner.submit(mutation);
    expect(conflict.status).toBe("conflict");
    expect((await connection.next()).type).toBe("changed");
    expect(await owner.submit(mutation)).toEqual(conflict);
  } finally {
    connection.socket.close();
    await server.stop(true);
    await context.close();
  }
});
