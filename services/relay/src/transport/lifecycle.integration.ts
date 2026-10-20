import { afterAll, beforeAll, expect, test } from "bun:test";
import { relayPath } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";
import { connectSocket } from "./socket.fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());
const serve = (context: Awaited<ReturnType<typeof fixture.context>>) =>
  startRelay({ hostname: "127.0.0.1", port: 0 }, context);

test("access expiry closes even while relay data is locked", async () => {
  const context = await fixture.context({ accessLifetimeSeconds: 2 });
  const server = serve(context);
  const connection = connectSocket(server.url, context.scope, context.token);
  let release = async () => {};
  let reading: Promise<Response> | undefined;
  try {
    expect((await connection.next()).type).toBe("ready");
    release = await fixture.blockRelayData();
    reading = fetch(new URL(relayPath(context.scope, "snapshot"), server.url), {
      headers: { authorization: `Bearer ${context.token}` },
    });
    await fixture.waitForBlockedData();
    await context.manager.removeDevice({ accountId: context.scope.accountId, deviceId: context.environmentId });
    expect((await connection.closed).code).toBe(1008);
    await release();
    release = async () => {};
    // An operation whose authority already succeeded may finish.
    expect((await reading).status).toBe(200);
  } finally {
    await release();
    await reading;
    connection.socket.close();
    await server.stop(true);
    await context.close();
  }
});

test("listener loss closes sockets and requires a fresh listener owner", async () => {
  const context = await fixture.context();
  const server = serve(context);
  const connection = connectSocket(server.url, context.scope, context.token);
  try {
    expect((await connection.next()).type).toBe("ready");
    await fixture.disconnectRelayListeners();
    expect((await connection.closed).code).toBe(1011);
    const request = await fetch(new URL(relayPath(context.scope, "changes"), server.url), {
      headers: { authorization: `Bearer ${context.token}` },
    });
    expect(request.status).toBe(503);
  } finally {
    connection.socket.close();
    await server.stop(true);
    await context.close();
  }
});

test("manager outage preserves unexpired HTTP access and socket notifications", async () => {
  const context = await fixture.context();
  const server = serve(context);
  const connection = connectSocket(server.url, context.scope, context.token);
  try {
    expect((await connection.next()).type).toBe("ready");
    await context.stopAuthority();
    expect(connection.socket.readyState).toBe(WebSocket.OPEN);
    await context.storage.owner(context.scope).publishRevision("published-notes", "offline-manager");
    expect((await connection.next()).type).toBe("changed");
    const request = await fetch(new URL(relayPath(context.scope, "snapshot"), server.url), {
      headers: { authorization: `Bearer ${context.token}` },
    });
    expect(request.status).toBe(200);
  } finally {
    connection.socket.close();
    await server.stop(true);
    await context.close();
  }
});

test("expiry ends an idle socket without a content notification", async () => {
  const context = await fixture.context({ accessLifetimeSeconds: 2 });
  const server = serve(context);
  const connection = connectSocket(server.url, context.scope, context.token);
  try {
    expect((await connection.next()).type).toBe("ready");
    expect((await connection.closed).code).toBe(1008);
    expect(connection.messages).toEqual([{ protocolVersion: 1, type: "ready" }]);
  } finally {
    connection.socket.close();
    await server.stop(true);
    await context.close();
  }
});

test("content restore and restart preserve finite access while stale manager restore denies renewal", async () => {
  const context = await fixture.context();
  let server = serve(context);
  try {
    const saved = await context.storage.owner(context.scope).snapshot();
    const authority = await context.manager.snapshot();
    const connection = connectSocket(server.url, context.scope, context.token);
    expect((await connection.next()).type).toBe("ready");
    await context.storage.owner(context.scope).restore(saved);
    expect((await connection.next()).type).toBe("changed");
    await context.manager.removeDevice({ accountId: context.scope.accountId, deviceId: context.environmentId });
    await expect(context.renew()).rejects.toThrow("Environment access unavailable");
    connection.socket.close();
    await context.storage.owner(context.scope).restore(saved);
    await server.stop(true);
    server = serve(context);
    const snapshot = () =>
      fetch(new URL(relayPath(context.scope, "snapshot"), server.url), {
        headers: { authorization: `Bearer ${context.token}` },
      });
    expect((await snapshot()).status).toBe(200);
    // Logging the removed device in again issues a new token.
    const fresh = await context.manager.registerDevice({
      accountId: context.scope.accountId,
      deviceId: context.environmentId,
      name: "Returning device",
      platform: "linux",
    });
    const access = await context.issue(fresh.token);
    const current = connectSocket(server.url, context.scope, access.token);
    expect((await current.next()).type).toBe("ready");
    await context.manager.restore("owned-stale-restore", authority);
    await expect(context.issue(fresh.token)).rejects.toThrow("Environment access unavailable");
    expect(current.socket.readyState).toBe(WebSocket.OPEN);
    current.socket.close();
    expect((await snapshot()).status).toBe(200);
  } finally {
    await server.stop(true);
    await context.close();
  }
});
