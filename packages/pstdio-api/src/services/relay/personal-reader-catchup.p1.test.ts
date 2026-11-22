import { expect, test } from "bun:test";
import { createLiveConnection, type LiveConnection } from "pstdio-sync/relay";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { streamPersonalSession } from "../../features/sessions/endpoints/stream-personal-session";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { historyNamespace } from "../personal-history/log-files";
import { startRelayPersonalHistory } from "./personal";

const until = async (condition: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 5000;
  while (!(await condition()) && Date.now() < end) await Bun.sleep(5);
  expect(await condition()).toBe(true);
};
const message = (id: string) => ({ id, role: "assistant" as const, parts: [{ type: "text" as const, text: id }] });

test("opening an advancing session catches up completed messages before displaying the current preview", async () => {
  const source = await createTestApp();
  const destination = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const syncs: ReturnType<typeof startRelayPersonalHistory>[] = [];
  const lives: LiveConnection[] = [];
  let aborted = false;
  let wake = () => {};
  let reading: Promise<boolean> | undefined;
  try {
    const project = await source.deps.projectService.create({ name: "Reader catch-up" });
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    const session = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Advancing",
      status: "in_progress",
      agent: "unavailable",
    });
    const conversation = await source.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
      .conversationReady;
    conversation.push({ op: "add", path: "/messages/0", value: message("complete-1") });
    conversation.push({ op: "add", path: "/messages/1", value: message("complete-2") });
    for (const app of [source, destination]) {
      const { environmentId: deviceId } = await app.deps.environmentService.get();
      const status = await app.deps.accountService.status();
      app.deps.accountService.status = async () => ({
        ...status,
        login: { accountId: "owner", deviceId, managerOrigin: peer.origin, relayOrigin: peer.origin },
        cloudProjects: [project.id],
        cloudProjectsLoaded: true,
      });
      app.deps.accountService.devices = async () => [];
      await app.deps.personalHistoryService.refreshIdentity();
      const config = {
        accountId: "owner",
        environmentId: deviceId,
        workbenchId: project.id,
        managerOrigin: peer.origin,
        relayOrigin: peer.origin,
        renewalGrant: "grant",
      };
      const access = async () => ({ token: deviceId, expiresAt: new Date(Date.now() + 60_000).toISOString() });
      const live = createLiveConnection({
        origin: peer.origin,
        projectId: project.id,
        access,
        signal: controller.signal,
      });
      lives.push(live);
      syncs.push(
        startRelayPersonalHistory({
          deps: app.deps,
          config,
          signal: controller.signal,
          access,
          live,
        }),
      );
    }
    const namespace = historyNamespace({ projectId: project.id, accountId: "owner", managerOrigin: peer.origin });
    const saved = () => destination.deps.personalHistoryService.logs.read(namespace, session.id);
    await until(async () => (await saved()).length === 1).catch(async (error) => {
      console.error({
        saved: await saved(),
        statuses: await Promise.all(syncs.map((sync) => sync.status())),
        documents: [...peer.documents].map(([id, updates]) => ({ id, updates: updates.length })),
      });
      throw error;
    });
    // Initial routing is independent of sync busy. The first reader's routes must stay inside the timed operation.
    // Read routing before busy: the final routing acknowledgement wakes the sync, so busy is only settled after it.
    const routingSettled = () =>
      lives.every((live) => {
        const status = live.status();
        return status.connected && !status.routingPending;
      });
    await until(async () => {
      if (!routingSettled()) return false;
      const owners = await Promise.all(syncs.map((sync) => sync.status()));
      // Sync can retain another route while these asynchronous status reads settle.
      return owners.every((owner) => !owner.busy) && routingSettled();
    });
    conversation.push({ op: "add", path: "/messages/2", value: message("current-3") });
    const frames: unknown[] = [];
    const shown = Promise.withResolvers<void>();
    const started = performance.now();
    reading = streamPersonalSession(session.id, destination.deps, {
      get aborted() {
        return aborted;
      },
      onAbort() {},
      sleep: () =>
        new Promise<void>((resolve) => {
          wake = resolve;
        }),
      write: async (event, data) => {
        frames.push({ event, data });
        if (JSON.stringify(data).includes("current-3")) shown.resolve();
      },
    });
    await shown.promise;
    expect(performance.now() - started).toBeLessThan(500);
    expect((await saved()).map((row) => row.id)).toEqual(["complete-1", "complete-2"]);
    expect(frames).toContainEqual({
      event: "patch",
      data: { op: "add", path: "/messages/2", value: message("current-3") },
    });
  } finally {
    aborted = true;
    wake();
    await reading;
    for (const sync of syncs) sync.close();
    controller.abort();
    for (const live of lives) live.close();
    await Promise.all(syncs.map((sync) => sync.done));
    await Promise.all(lives.map((live) => live.done));
    await peer.close();
    await destination.close();
    await source.close();
  }
});
