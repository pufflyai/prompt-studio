import { expect, test } from "bun:test";
import { createSyncSpace, openLive } from "pstdio-sync/encryption";
import { createLiveConnection } from "pstdio-sync/relay";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { personalLiveTopic } from "../personal-history/live-messages";
import { startRelayPersonalHistory } from "./personal";

const until = async (condition: () => boolean) => {
  const end = Date.now() + 4000;
  while (!condition() && Date.now() < end) await Bun.sleep(5);
  expect(condition()).toBe(true);
};

test("a sole preview during held ownership reaches its reader after admission without another chunk", async () => {
  const app = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let sync: ReturnType<typeof startRelayPersonalHistory> | undefined;
  let observer: ReturnType<typeof createLiveConnection> | undefined;
  let stop: (() => void) | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Held ownership" });
    const session = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Sole preview",
      status: "in_progress",
      agent: "unavailable",
    });
    const conversation = await app.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
      .conversationReady;
    const space = await createSyncSpace({
      projectId: project.id,
      spaceOwner: "bob",
      keys: [{ generation: 1, secret: "B".repeat(43) }],
    });
    app.deps.accountService.devices = async () => {
      entered.resolve();
      await release.promise;
      return [];
    };
    sync = startRelayPersonalHistory({
      deps: app.deps,
      config: {
        accountId: "bob",
        workbenchId: project.id,
        environmentId: "bob-source",
        managerOrigin: peer.origin,
        relayOrigin: peer.origin,
        renewalGrant: "grant",
      },
      signal: controller.signal,
      access: async () => ({ token: "bob-source", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
    await entered.promise;
    const received: unknown[] = [];
    observer = createLiveConnection({
      origin: peer.origin,
      projectId: project.id,
      signal: controller.signal,
      access: async () => ({ token: "bob-reader", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
    stop = observer.listen((event) => {
      if (event.type === "event")
        void openLive(space, event).then((clear) => {
          for (const frame of JSON.parse(new TextDecoder().decode(clear)))
            if (frame.end) received.push(JSON.parse(frame.text));
        });
    });
    observer.subscribe({ spaceOwner: "bob", topic: await personalLiveTopic(space, session.id) });
    const message = {
      id: "sole",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "One chunk before ownership capture returns" }],
    };
    conversation.push({ op: "add", path: "/messages/0", value: message });
    await Bun.sleep(400);
    expect(received).toEqual([]);
    release.resolve();
    await until(() => received.length > 0);
    expect(received).toContainEqual(message);
    expect(conversation.getMessages()).toEqual([message]);
  } finally {
    release.resolve();
    stop?.();
    sync?.close();
    controller.abort();
    observer?.close();
    await Promise.all([sync?.done, observer?.done]);
    await peer.close();
    await app.close();
  }
});
