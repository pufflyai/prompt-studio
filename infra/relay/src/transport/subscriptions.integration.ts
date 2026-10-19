import { afterAll, beforeAll, expect, test } from "bun:test";
import { fingerprint, relayPath, sealMutation } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";
import { connectSocket } from "./socket.fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("ready sockets see only their committed scope while revoked renewal leaves issued access valid", async () => {
  const first = await fixture.context();
  const second = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, first);
  const a = connectSocket(server.url, first.scope, first.token);
  const b = connectSocket(server.url, second.scope, second.token);
  try {
    expect((await a.next()).type).toBe("ready");
    expect((await b.next()).type).toBe("ready");
    const commit = async (context: typeof first) =>
      context.storage.owner(context.scope).submit(
        await sealMutation({
          protocolVersion: 1,
          scope: context.scope,
          environmentId: context.environmentId,
          operationId: "same-id",
          parents: [],
          changes: [
            {
              recordId: "same-record",
              expectedRevision: 0,
              baseDeleted: false,
              value: { expected: await fingerprint(null), next: context.scope.accountId },
            },
          ],
        }),
      );
    await commit(first);
    expect(await a.next()).toEqual({ protocolVersion: 1, type: "changed" });
    expect((await first.storage.owner(first.scope).snapshot()).records["same-record"]!.value).toBe(
      first.scope.accountId,
    );
    expect(b.messages).toHaveLength(1);
    await commit(second);
    expect((await b.next()).type).toBe("changed");
    expect(a.messages).toHaveLength(2);
    await first.manager.removeDevice({ accountId: first.scope.accountId, deviceId: first.environmentId });
    await expect(first.renew()).rejects.toThrow("Environment access unavailable");
    expect(a.socket.readyState).toBe(WebSocket.OPEN);
    expect(b.socket.readyState).toBe(WebSocket.OPEN);
    const response = await fetch(new URL(relayPath(first.scope, "snapshot"), server.url), {
      headers: { authorization: `Bearer ${first.token}` },
    });
    expect(response.status).toBe(200);
    await second.storage.owner(second.scope).publishRevision("published-notes", "published-next");
    expect((await b.next()).type).toBe("changed");
  } finally {
    a.socket.close();
    b.socket.close();
    await server.stop(true);
    await first.close();
    await second.close();
  }
});
