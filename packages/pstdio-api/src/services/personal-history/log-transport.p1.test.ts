import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace, openLive, openUpdate } from "pstdio-sync";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { discardLegacyHistory } from "../relay/personal-context";
import { createLiveReceiver } from "./live-messages";
import { messageEntries } from "./log-entries";
import { createSessionLogFiles } from "./log-files";
import { createLogPublisher } from "./log-publisher";
import { createLogReceiver } from "./log-receiver";
import { logRelayFixture } from "./log-transport.fixture";
import { publishLogUpdate } from "./log-updates";

const app = await createTestApp();
const project = await app.deps.projectService.create({ name: "Log transport" });
const root = await mkdtemp(join(tmpdir(), "session-log-tests-"));
afterAll(async () => {
  await app.close();
  await rm(root, { recursive: true, force: true });
});
const space = await createSyncSpace({
  projectId: "project",
  spaceOwner: "account",
  keys: [{ generation: 1, secret: "A".repeat(43) }],
});
const message = (id: string, text: string) => ({
  id,
  role: "assistant" as const,
  parts: [{ type: "text" as const, text }],
});

test("publishing persists only completed changes and resumes without republishing after restart", async () => {
  const session = await app.deps.sessionService.create({
    agent: "unavailable",
    project_id: project.id,
    title: "Stream",
    status: "in_progress",
  });
  const conversation = await app.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
    .conversationReady;
  conversation.push({
    op: "replace",
    path: "/messages",
    value: [message("first", "complete"), message("second", "streaming secret")],
  });
  const files = createSessionLogFiles(root);
  const peer = logRelayFixture();
  const heads = new Map<string, number>();
  const create = () =>
    createLogPublisher({
      files,
      namespace: "publisher",
      deviceId: "source",
      deps: app.deps,
      published: (id, head) => heads.set(id, head),
    });
  let publisher = create();
  try {
    await publisher.publish([session.id], space, peer.relay);
    const writes = () => [...peer.updates.values()].flat();
    expect(writes()).toHaveLength(1);
    const documentId = [...peer.updates.keys()][0]!;
    expect(new TextDecoder().decode(await openUpdate(space, documentId, writes()[0]!))).not.toContain(
      "streaming secret",
    );
    const live = Promise.withResolvers<Parameters<typeof openLive>[1]>();
    publisher.live(session.id, space, (update) => live.resolve({ ...update, deviceId: "source" }));
    const shown: unknown[] = [];
    const liveReader = createLiveReceiver((_id, _index, message) => shown.push(message));
    liveReader.receive(JSON.parse(new TextDecoder().decode(await openLive(space, await live.promise))));
    expect(shown).toEqual([message("second", "streaming secret")]);
    expect(writes()).toHaveLength(1);
    publisher.close();
    publisher = create();
    await publisher.publish([session.id], space, peer.relay, { skipUnchanged: true });
    expect(writes()).toHaveLength(1);
    conversation.push({ op: "replace", path: "/messages/0", value: message("first", "late correction") });
    conversation.push({ op: "add", path: "/messages/2", value: message("third", "still live") });
    await publisher.publish([session.id], space, peer.relay);
    expect(writes()).toHaveLength(2);
    const received = createSessionLogFiles(join(root, "receiver"));
    let receiver = createLogReceiver({ files: received, namespace: "reader", received() {} });
    await receiver.read([session.id], space, peer.relay);
    expect(await received.read("reader", session.id)).toEqual([
      message("first", "late correction"),
      message("second", "streaming secret"),
    ]);
    receiver = createLogReceiver({ files: received, namespace: "reader", received() {} });
    expect(await receiver.behind([session.id], heads)).toEqual([]);
    await receiver.read([session.id], space, peer.relay);
    expect(peer.reads.at(-1)).toBe(2);
  } finally {
    publisher.close();
  }
});

test("oversized completed messages use encrypted blobs and remain readable after receiver restart", async () => {
  const session = await app.deps.sessionService.create({
    agent: "unavailable",
    project_id: project.id,
    title: "Large",
    status: "completed",
  });
  const conversation = await app.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
    .conversationReady;
  const large = message("large", "private large output 😀".repeat(100_000));
  conversation.push({ op: "add", path: "/messages/0", value: large });
  const files = createSessionLogFiles(root);
  const peer = logRelayFixture();
  const publisher = createLogPublisher({
    files,
    namespace: "large",
    deviceId: "source",
    deps: app.deps,
    published() {},
  });
  try {
    await publisher.publish([session.id], space, peer.relay);
    expect(peer.blobs.size).toBe(1);
    for (const bytes of peer.blobs.values())
      expect(new TextDecoder().decode(bytes)).not.toContain("private large output");
    const received = createSessionLogFiles(join(root, "large-reader"));
    const receiver = createLogReceiver({ files: received, namespace: "large", received() {} });
    await receiver.read([session.id], space, peer.relay);
    expect(await createSessionLogFiles(join(root, "large-reader")).read("large", session.id)).toEqual([large]);
  } finally {
    publisher.close();
  }
});

test("catch-up commits each expanded blob before downloading the next and resumes at the last durable update", async () => {
  const peer = logRelayFixture();
  const id = await space.documentId(JSON.stringify(["pstdio.personal-history", "log", "catch-up"]));
  const transport = peer.relay(id);
  for (let index = 0; index < 2; index++)
    await publishLogUpdate(
      space,
      id,
      transport,
      messageEntries(index, message(String(index), "large".repeat(160_000))),
    );
  const files = createSessionLogFiles(join(root, "catch-up"));
  let downloaded = 0;
  const relay = () => ({
    ...transport,
    read: async () => ({
      status: "updates" as const,
      state: null,
      lastSequence: 2,
      more: false,
      updates: peer.updates.get(id)!,
    }),
    blobs: {
      ...transport.blobs!,
      async get(blobId: string) {
        if (++downloaded === 2) {
          expect(await files.readPosition("reader", "catch-up")).toEqual({ after: 1 });
          throw new Error("connection interrupted");
        }
        return transport.blobs!.get(blobId);
      },
    },
  });
  await expect(
    createLogReceiver({ files, namespace: "reader", received() {} }).read(["catch-up"], space, relay),
  ).rejects.toThrow("connection interrupted");
  await createLogReceiver({ files, namespace: "reader", received() {} }).read(["catch-up"], space, () => transport);
  expect((await files.read("reader", "catch-up")).map((row) => row.id)).toEqual(["0", "1"]);
  expect(await files.readPosition("reader", "catch-up")).toEqual({ after: 2 });
});

test("upgrade discards legacy transcript journals without opening them or deleting local conversations", async () => {
  const config = {
    workbenchId: project.id,
    accountId: "alice",
    managerOrigin: "https://manager.example",
    relayOrigin: "https://relay.example",
    renewalGrant: "credential",
    environmentId: "device",
  };
  const owner = {
    workbenchId: project.id,
    extensionId: JSON.stringify(["pstdio.personal-history", config.managerOrigin, config.accountId]),
  };
  const documents = app.deps.extensionStorageService.documents;
  const name = JSON.stringify(["transcript", "old-session"]);
  await documents.open(name).transaction(owner, async ({ document }) => {
    document.getText("content").insert(0, "old transcript".repeat(100_000));
  });
  const open = documents.open;
  documents.open = (id) => {
    if (id === name) throw new Error("Upgrade opened a legacy transcript");
    return open(id);
  };
  try {
    await discardLegacyHistory(config, app.deps);
  } finally {
    documents.open = open;
  }
  expect(await documents.open(name).revision(owner)).toBe(0);
  expect(await app.deps.projectService.get(project.id)).not.toBeNull();
});
