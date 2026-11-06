import { expect, test } from "bun:test";
import { createSyncSpace, openLive } from "pstdio-sync/encryption";
import { createLiveConnection } from "pstdio-sync/relay";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { capturePersonalHistory } from "../personal-history/capture";
import { personalLiveTopic } from "../personal-history/live-messages";
import { createHistoryReferences, historyReferenceName } from "../personal-history/references";
import { createPersonalHistoryStore } from "../personal-history/store";
import { startRelayPersonalHistory } from "./personal";

const until = async (condition: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 4000;
  while (!(await condition()) && Date.now() < end) await Bun.sleep(5);
  expect(await condition()).toBe(true);
};

test("rebinding to Bob does not send Alice-owned local previews into Bob's private wire topic", async () => {
  const source = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  let sync: ReturnType<typeof startRelayPersonalHistory> | undefined;
  let observer: ReturnType<typeof createLiveConnection> | undefined;
  let stop: (() => void) | undefined;
  try {
    const project = await source.deps.projectService.create({ name: "Live preview ownership" });
    source.deps.accountService.devices = async () => [];
    const makeSession = (title: string) =>
      source.deps.sessionService.create({ project_id: project.id, title, status: "in_progress", agent: "unavailable" });
    const aliceSession = await makeSession("Alice private");
    const history = (accountId: string) =>
      createPersonalHistoryStore({
        projectId: project.id,
        accountId,
        managerOrigin: peer.origin,
        documents: source.deps.extensionStorageService.documents,
        files: source.deps.personalHistoryService.logs,
      });
    const aliceHistory = history("alice");
    await capturePersonalHistory({
      projectId: project.id,
      device: { ownerId: "alice", id: "alice-device", name: "Before rebinding" },
      history: aliceHistory,
      references: createHistoryReferences(
        source.deps.extensionStorageService.documents.open(historyReferenceName),
        project.id,
      ),
      deps: source.deps,
    });
    const bobSession = await makeSession("Bob private");
    const aliceConversation = await source.deps.sessionService.store.create(aliceSession.id, inertSessionChannelHooks)
      .conversationReady;
    const bobConversation = await source.deps.sessionService.store.create(bobSession.id, inertSessionChannelHooks)
      .conversationReady;
    const bobSpace = await createSyncSpace({
      projectId: project.id,
      spaceOwner: "bob",
      keys: [{ generation: 1, secret: "B".repeat(43) }],
    });
    const topic = await personalLiveTopic(bobSpace, bobSession.id);
    const frames: { sessionId: string; text: string; end: boolean }[] = [];
    observer = createLiveConnection({
      origin: peer.origin,
      projectId: project.id,
      signal: controller.signal,
      access: async () => ({ token: "bob-observer", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
    stop = observer.listen((event) => {
      if (event.type === "event")
        void openLive(bobSpace, event).then((clear) => {
          frames.push(...JSON.parse(new TextDecoder().decode(clear)));
        });
    });
    observer.subscribe({ spaceOwner: "bob", topic });
    observer.subscribe({ spaceOwner: "bob", topic: await personalLiveTopic(bobSpace, aliceSession.id) });
    await until(() =>
      peer
        .subscriptions()
        .some((entry) => entry.deviceId === "bob-observer" && entry.topics.includes(JSON.stringify(["bob", topic]))),
    );
    sync = startRelayPersonalHistory({
      deps: source.deps,
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
    await until(
      async () =>
        !(await sync!.status()).busy &&
        peer.subscriptions().some((entry) => entry.deviceId === "bob-source" && entry.topics.length === 3),
    );
    const bobIndexed = await history("bob").readRecords("sessions");
    expect(bobIndexed.map((row) => row.id)).toEqual([bobSession.id]);
    expect(bobIndexed.some((row) => row.id === aliceSession.id)).toBe(false);
    aliceConversation.push({
      op: "add",
      path: "/messages/0",
      value: { id: "alice-secret", role: "assistant", parts: [{ type: "text", text: "Alice-only streaming secret" }] },
    });
    bobConversation.push({
      op: "add",
      path: "/messages/0",
      value: { id: "bob-message", role: "assistant", parts: [{ type: "text", text: "Bob legitimate preview" }] },
    });
    await until(() => frames.some((frame) => frame.sessionId === bobSession.id && frame.end));
    expect(frames.some((frame) => frame.sessionId === aliceSession.id)).toBe(false);
  } finally {
    stop?.();
    sync?.close();
    controller.abort();
    observer?.close();
    await Promise.all([sync?.done, observer?.done]);
    await peer.close();
    await source.close();
  }
});
