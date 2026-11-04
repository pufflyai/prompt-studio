import { expect, test } from "bun:test";
import { createLiveConnection } from "pstdio-sync/relay";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayPersonalHistory } from "./personal";

const until = async (condition: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 5000;
  while (!(await condition()) && Date.now() < end) await Bun.sleep(5);
  expect(await condition()).toBe(true);
};

test("planned access renewal refreshes personal keys while retaining the small index subscriptions", async () => {
  const app = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  let generation = 1;
  let keyReads = 0;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      keyReads++;
      const keys = [{ generation: 1, secret: "B".repeat(43) }];
      if (generation === 2) keys.push({ generation: 2, secret: "C".repeat(43) });
      return Response.json({ project: keys, personal: keys });
    },
  });
  let grants = 0;
  let expiresAt = 0;
  const access = async () => {
    if (expiresAt <= Date.now()) expiresAt = Date.now() + (++grants < 3 ? 3000 : 60_000);
    return { token: "device", expiresAt: new Date(expiresAt).toISOString() };
  };
  const project = await app.deps.projectService.create({ name: "Key renewal" });
  const live = createLiveConnection({ origin: peer.origin, projectId: project.id, access, signal: controller.signal });
  let ready = 0;
  const stop = live.listen((event) => {
    if (event.type === "ready") ready++;
  });
  app.deps.accountService.devices = async () => [];
  const sync = startRelayPersonalHistory({
    deps: app.deps,
    config: {
      accountId: "alice",
      workbenchId: project.id,
      environmentId: (await app.deps.environmentService.get()).environmentId,
      managerOrigin: manager.url.origin,
      relayOrigin: peer.origin,
      renewalGrant: "grant",
    },
    signal: controller.signal,
    access,
    live,
  });
  try {
    await until(async () => ready === 1 && !(await sync.status()).busy);
    expect(keyReads).toBe(1);
    const documentIds = [...peer.documents.keys()].sort();
    expect(documentIds).toHaveLength(2);
    await until(async () => ready === 2 && !(await sync.status()).busy);
    expect(keyReads).toBe(2);
    expect([...peer.documents.keys()].sort()).toEqual(documentIds);
    expect(peer.subscriptions().map((entry) => entry.topics.length)).toEqual([2]);
    generation = 2;
    await until(async () => ready === 3 && !(await sync.status()).busy);
    expect(keyReads).toBe(3);
    await app.deps.sessionService.create({ project_id: project.id, title: "New key", agent: "unavailable" });
    await until(() =>
      [...peer.documents.values()].flat().some((update) => Buffer.from(update.payload, "base64").readUInt32BE(1) === 2),
    );
    await until(async () => !(await sync.status()).busy);
    expect([...peer.documents.keys()]).toHaveLength(3);
    expect(documentIds.every((id) => peer.documents.has(id))).toBe(true);
    expect(peer.subscriptions().map((entry) => entry.topics.length)).toEqual([3]);
  } finally {
    stop();
    sync.close();
    controller.abort();
    await Promise.all([sync.done, live.done]);
    await manager.stop(true);
    await peer.close();
    await app.close();
  }
});
