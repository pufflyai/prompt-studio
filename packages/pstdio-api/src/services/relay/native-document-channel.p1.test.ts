import { expect, spyOn, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createDocumentRelayConnection, createLiveConnection } from "pstdio-sync/relay";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createNativeSessionPresence } from "../native-documents/session-presence";
import { createNativeDocumentChannel } from "./native-document-channel";

const until = async (condition: () => boolean) => {
  const end = Date.now() + 3000;
  while (!condition() && Date.now() < end) await Bun.sleep(1);
  expect(condition()).toBe(true);
};

test("v2 presence converges through a held durable owner and survives renewal before clearing on offline", async () => {
  const peer = documentPeer();
  const controller = new AbortController();
  const renewal = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const renewalEntered = Promise.withResolvers<void>();
  const managers = ["sender", "receiver"].map((deviceId) =>
    createNativeSessionPresence({
      deviceId,
      identity: async () => ({ label: deviceId === "sender" ? "Alice private" : "Receiver", deviceName: deviceId }),
    }),
  );
  let grants = 0;
  const channels = ["sender", "receiver", "uninterested"].map((deviceId) =>
    createLiveConnection({
      origin: peer.origin,
      projectId: "project",
      signal: controller.signal,
      access: async () => {
        if (deviceId === "sender") {
          if (++grants > 1) {
            renewalEntered.resolve();
            return renewal.promise;
          }
          return { token: deviceId, expiresAt: new Date(Date.now() + 1000).toISOString() };
        }
        return { token: deviceId, expiresAt: new Date(Date.now() + 60_000).toISOString() };
      },
    }),
  );
  const bridges = managers.map((manager, i) =>
    createNativeDocumentChannel({
      projectId: "project",
      deviceId: i ? "receiver" : "sender",
      live: manager.live,
      channel: channels[i]!,
    }),
  );
  const release = Promise.withResolvers<void>(),
    entered = Promise.withResolvers<void>();
  let durableRuns = 0,
    unrelatedEvents = 0;
  channels[2]!.listen((event) => {
    if (event.type === "event") unrelatedEvents++;
  });
  const background = createDocumentRelayConnection({
    live: channels[0],
    origin: peer.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "sender", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    synchronize: async () => {
      durableRuns++;
      entered.resolve();
      await release.promise;
    },
  });
  const publishing = spyOn(channels[0]!, "publish");
  const locals: Awaited<ReturnType<(typeof managers)[0]["join"]>>[] = [];
  try {
    const space = await createSyncSpace({
      projectId: "project",
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    for (const bridge of bridges) bridge.setSpace(space);
    await entered.promise;
    for (const manager of managers)
      locals.push(
        await manager.join(
          { owner: { workbenchId: "project", extensionId: "example.notes" }, documentKey: "a".repeat(64) },
          { roomId: crypto.randomUUID(), seedId: "b".repeat(64) },
        ),
      );
    await until(() => locals.every((local) => local.snapshot().length === 2));
    expect(locals[1]!.snapshot()).toContainEqual(expect.objectContaining({ label: "Alice private" }));
    expect(JSON.stringify(publishing.mock.calls)).not.toContain("Alice private");
    expect(peer.documents.size).toBe(0);
    expect(unrelatedEvents).toBe(0);
    expect(durableRuns).toBe(1);
    await renewalEntered.promise;
    expect(locals[0]!.snapshot()).toHaveLength(2);
    renewal.resolve({ token: "sender", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    await until(() => peer.subscriptions().filter((entry) => entry.topics.length).length === 2);
    expect(locals[0]!.snapshot()).toHaveLength(2);
    expect(durableRuns).toBe(1);
    await peer.close();
    await until(() => locals.every((local) => local.snapshot().length === 1));
  } finally {
    renewal.resolve({ token: "sender", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    for (const local of locals) local.close();
    release.resolve();
    controller.abort();
    publishing.mockRestore();
    await background.done;
    await Promise.all(bridges.map((bridge) => bridge.close()));
    await Promise.all(channels.map((channel) => channel.done));
    for (const manager of managers) manager.close();
    await peer.close();
  }
});
