import { expect, test } from "bun:test";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { historyNamespace } from "../personal-history/log-files";
import { startRelayPersonalHistory } from "./personal";

const until = async (condition: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 5000;
  while (!(await condition()) && Date.now() < end) await Bun.sleep(5);
  expect(await condition()).toBe(true);
};

test("protocol 2 streams private previews and catches up history with subscriptions bounded by index writers", async () => {
  const source = await createTestApp();
  const destination = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const syncs: ReturnType<typeof startRelayPersonalHistory>[] = [];
  try {
    const project = await source.deps.projectService.create({ name: "Private protocol" });
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    const config = {
      accountId: "alice",
      workbenchId: project.id,
      managerOrigin: peer.origin,
      relayOrigin: peer.origin,
      renewalGrant: "grant",
    };
    const namespace = historyNamespace({ ...config, projectId: project.id });
    source.deps.accountService.devices = destination.deps.accountService.devices = async () => [];
    const session = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Streaming",
      status: "in_progress",
      agent: "unavailable",
    });
    const conversation = await source.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
      .conversationReady;
    await destination.deps.personalHistoryService.refreshIdentity();
    const received: { live: boolean; message: unknown }[] = [];
    const stop = destination.deps.personalHistoryService.watchMessages(session.id, (update) => received.push(update));
    for (const [app, device] of [
      [source, (await source.deps.environmentService.get()).environmentId],
      [destination, (await destination.deps.environmentService.get()).environmentId],
    ] as const)
      syncs.push(
        startRelayPersonalHistory({
          deps: app.deps,
          config: { ...config, environmentId: device },
          signal: controller.signal,
          access: async () => ({ token: device, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        }),
      );
    await until(
      () => peer.subscriptions().length === 2 && peer.subscriptions().every((entry) => entry.topics.length === 4),
    );
    const message = {
      id: "message",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Private streaming text" }],
    };
    conversation.push({ op: "add", path: "/messages/0", value: message });
    await until(() => received.some((entry) => entry.live));
    expect(received.find((entry) => entry.live)?.message).toEqual(message);
    await source.deps.sessionService.transitionStatus(session.id, "completed", { drainCapacity: false });
    await until(
      async () => (await destination.deps.personalHistoryService.logs.read(namespace, session.id)).length === 1,
    );
    expect(await destination.deps.personalHistoryService.logs.read(namespace, session.id)).toEqual([message]);
    expect(received.some((entry) => !entry.live)).toBe(true);
    // Historical log traffic must not add a subscription for every saved session.
    const savedIds: string[] = [];
    for (let index = 0; index < 12; index++) {
      const saved = await source.deps.sessionService.create({
        project_id: project.id,
        title: `Saved ${index}`,
        status: "completed",
        agent: "unavailable",
      });
      const history = await source.deps.sessionService.store.create(saved.id, inertSessionChannelHooks)
        .conversationReady;
      history.push({ op: "add", path: "/messages/0", value: { ...message, id: `message-${index}` } });
      await source.deps.sessionService.update(saved.id, {});
      savedIds.push(saved.id);
    }
    await until(async () =>
      (await Promise.all(savedIds.map((id) => destination.deps.personalHistoryService.logs.read(namespace, id)))).every(
        (messages) => messages.length === 1,
      ),
    );
    expect(peer.subscriptions().map((entry) => entry.topics.length)).toEqual([4, 4]);
    stop();
  } finally {
    for (const sync of syncs) sync.close();
    controller.abort();
    await Promise.all(syncs.map((sync) => sync.done));
    await peer.close();
    await destination.close();
    await source.close();
  }
});
