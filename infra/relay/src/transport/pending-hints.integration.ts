import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import { fingerprint } from "pstdio-sync-contracts";
import { sealStoredMutation } from "../storage/mutation.fixture";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
const sealMutation = (body: Parameters<typeof sealStoredMutation>[0]) =>
  sealStoredMutation(body, fixture.relayDatabaseUrl);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("unchanged pending retries stay quiet while accepted dependencies still advance them", async () => {
  const context = await fixture.context();
  const listener = new Client({ connectionString: fixture.relayDatabaseUrl });
  try {
    await listener.connect();
    await listener.query("LISTEN relay_scope_changed");
    const hints: string[] = [];
    listener.on("notification", (message) => hints.push(message.payload!));
    const owner = context.storage.owner(context.scope);
    const create = async (operationId: string, parents: string[]) =>
      sealMutation({
        protocolVersion: 2,
        scope: context.scope,
        environmentId: context.environmentId,
        operationId,
        parents,
        changes: [
          {
            recordId: operationId,
            expectedRevision: 0,
            baseDeleted: false,
            value: { expected: await fingerprint(null), next: operationId },
          },
        ],
      });
    const pending = await create("child", ["parent"]);
    const first = await owner.submit(pending);
    expect(first.status).toBe("pending");
    expect(await owner.submit(pending)).toEqual(first);
    const flush = async () => {
      const marker = crypto.randomUUID();
      const delivered = Promise.withResolvers<void>();
      const observe = (message: { payload?: string }) => {
        if (message.payload === marker) delivered.resolve();
      };
      listener.on("notification", observe);
      try {
        await listener.query("SELECT pg_notify('relay_scope_changed', $1)", [marker]);
        await delivered.promise;
      } finally {
        listener.off("notification", observe);
      }
    };
    await flush();
    const key = await fingerprint(context.scope);
    expect(hints.filter((hint) => hint === key)).toHaveLength(1);
    expect((await owner.submit(await create("parent", []))).status).toBe("accepted");
    expect((await owner.submit(pending)).status).toBe("accepted");
    await flush();
    expect(hints.filter((hint) => hint === key)).toHaveLength(3);
  } finally {
    await listener.end();
    await context.close();
  }
});
