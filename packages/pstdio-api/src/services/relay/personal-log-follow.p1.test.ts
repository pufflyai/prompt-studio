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

test("an active reader follows completed generic log entries before the next batched index head", async () => {
  const source = await createTestApp();
  const destination = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const syncs: ReturnType<typeof startRelayPersonalHistory>[] = [];
  let stop: (() => void) | undefined;
  try {
    const project = await source.deps.projectService.create({ name: "Active log reader" });
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
      title: "Reading",
      agent: "unavailable",
      status: "in_progress",
    });
    const conversation = await source.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
      .conversationReady;
    await destination.deps.personalHistoryService.refreshIdentity();
    let live = false;
    stop = destination.deps.personalHistoryService.watchMessages(
      session.id,
      (update) => {
        live ||= update.live;
      },
      project.id,
    );
    for (const app of [source, destination]) {
      const device = (await app.deps.environmentService.get()).environmentId;
      syncs.push(
        startRelayPersonalHistory({
          deps: app.deps,
          config: { ...config, environmentId: device },
          signal: controller.signal,
          access: async () => ({ token: device, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        }),
      );
    }
    const message = (id: string) => ({ id, role: "assistant" as const, parts: [{ type: "text" as const, text: id }] });
    conversation.push({ op: "add", path: "/messages/0", value: message("first") });
    await until(() => live);
    conversation.push({ op: "add", path: "/messages/1", value: message("second") });
    const received = () => destination.deps.personalHistoryService.logs.read(namespace, session.id);
    await until(async () => (await received()).length === 1);
    await until(async () => !(await syncs[0]!.status()).busy);
    conversation.push({ op: "add", path: "/messages/2", value: message("third") });
    await until(async () => (await received()).length === 2);
    expect(await received()).toEqual([message("first"), message("second")]);
    expect((await source.deps.sessionService.get(session.id))?.status).toBe("in_progress");
  } finally {
    stop?.();
    for (const sync of syncs) sync.close();
    controller.abort();
    await Promise.all(syncs.map((sync) => sync.done));
    await peer.close();
    await destination.close();
    await source.close();
  }
});
