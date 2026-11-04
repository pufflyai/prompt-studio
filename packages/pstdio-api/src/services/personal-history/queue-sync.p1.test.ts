import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { streamPersonalSession } from "../../features/sessions/endpoints/stream-personal-session";
import { createTestApp } from "../../test-utils/create-test-app";
import { createNativeStore } from "../account/native-store";
import { capturePersonalHistory } from "./capture";
import { logRelayFixture } from "./log-transport.fixture";
import { maxSharedQueuePrompt } from "./queue-snapshot";
import { createHistoryReferences, historyReferenceName } from "./references";
import { createPersonalHistoryStore } from "./store";

const root = await mkdtemp(join(tmpdir(), "personal-queue-"));
afterAll(() => rm(root, { recursive: true, force: true }));

interface QueuedMessages {
  messages: { id: string; parts: { text: string }[] }[];
  queue: { requests: { queuePosition: number }[]; steeringAvailable: boolean };
}
const prompts = (body: QueuedMessages) => body.messages.map((message) => message.parts[0]!.text);

test("another device's queued messages are readable in order, kept out of session records, and pushed to followers", async () => {
  const managerOrigin = "https://127.0.0.1:1";
  const accountId = "alice";
  const source = await createTestApp();
  const databasePath = join(root, "database");
  const storageRoot = join(root, "storage");
  let destination = await createTestApp({ databasePath, storageRoot });
  try {
    const project = await source.deps.projectService.create({ name: "Queue" });
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    const running = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Running",
      status: "in_progress",
      agent: "unavailable",
    });
    const idle = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Idle",
      status: "completed",
      agent: "unavailable",
    });
    const queue = source.deps.sessionQueueEntriesService;
    await queue.create({ session_id: running.id, prompt: "Then update the changelog.", request_kind: "follow_up" });
    // A request being steered into the running turn is part of the conversation, not the queue.
    await queue.createSteeringDelivery(
      { session_id: running.id, prompt: "Steered now.", request_kind: "follow_up" },
      { id: "delivery", runStartedAt: new Date().toISOString() },
    );
    // Previews cut at a character boundary, never inside an emoji.
    await queue.create({
      session_id: running.id,
      prompt: `${"x".repeat(maxSharedQueuePrompt - 1)}🙂🙂`,
      request_kind: "follow_up",
    });
    await queue.create({ session_id: running.id, prompt: "Open a draft pull request.", request_kind: "follow_up" });

    const history = createPersonalHistoryStore({
      projectId: project.id,
      managerOrigin,
      accountId,
      documents: source.deps.extensionStorageService.documents,
      files: source.deps.personalHistoryService.logs,
    });
    const references = createHistoryReferences(
      source.deps.extensionStorageService.documents.open(historyReferenceName),
      project.id,
    );
    const device = { ownerId: accountId, id: "source-device", name: "Laptop" };
    const capture = () =>
      capturePersonalHistory({ projectId: project.id, device, history, references, deps: source.deps });
    const space = await createSyncSpace({
      projectId: project.id,
      spaceOwner: accountId,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const relay = logRelayFixture();
    const copyRecords = async () => {
      await history.synchronizeIndex(device.id, true, space, relay.relay);
      const target = createPersonalHistoryStore({
        projectId: project.id,
        managerOrigin,
        accountId,
        documents: destination.deps.extensionStorageService.documents,
        files: destination.deps.personalHistoryService.logs,
      });
      await target.synchronizeIndex(device.id, false, space, relay.relay);
    };
    await capture();

    // Saving messages rewrites session records; the queue lives in its own record, only while it has requests.
    for (const record of await history.readRecords("sessions")) expect(record).not.toHaveProperty("queue");
    expect((await history.readRecords("queues")).map((record) => record.id)).toEqual([running.id]);

    await copyRecords();
    const { environmentId } = await destination.deps.environmentService.get();
    await createNativeStore(join(root, "native-account.json")).save({
      managerOrigin,
      relayOrigin: managerOrigin,
      accountId,
      deviceId: environmentId,
      token: "offline-credential",
    });
    await destination.close();
    destination = await createTestApp({ databasePath, storageRoot });

    const response = await destination.app.request(`/v1/sessions/${running.id}/queued-messages`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as QueuedMessages;
    expect(prompts(body)).toEqual([
      "Then update the changelog.",
      `${"x".repeat(maxSharedQueuePrompt - 1)}🙂…`,
      "Open a draft pull request.",
    ]);
    expect(body.messages[0]!.id).toBe(`queued-prompt-${running.id}-${body.queue.requests[0]!.queuePosition}`);
    expect(body.queue.steeringAvailable).toBe(false);

    const followUps = await destination.app.request(`/v1/sessions/${running.id}/queued-follow-ups`);
    expect(followUps.status).toBe(200);
    expect((await followUps.json()).requests).toHaveLength(3);
    const idleQueue = await destination.app.request(`/v1/sessions/${idle.id}/queued-messages`);
    expect(await idleQueue.json()).toMatchObject({ messages: [], queue: { requests: [] } });
    // Only the device that runs the session changes its queue.
    const removal = await destination.app.request(
      `/v1/sessions/${running.id}/queued-follow-ups/${body.queue.requests[0]!.queuePosition}`,
      { method: "DELETE" },
    );
    expect(removal.status).toBe(400);
    expect(await removal.json()).toMatchObject({ error: expect.any(String) });
    expect(await destination.deps.sessionQueueEntriesService.listPendingBySession(running.id)).toEqual([]);
    expect(await source.deps.sessionQueueEntriesService.listPendingBySession(running.id)).toHaveLength(3);

    const state = await destination.deps.syncService.getFullState();
    expect((state.sessions as { id: string }[]).find((row) => row.id === running.id)).not.toHaveProperty("queue");

    // A follower gets the queue at once. A session row event wakes it for the next change; the
    // two-second timer never fires here.
    const frames: { event: string; data: unknown }[] = [];
    let sleeps = 0;
    const sink = {
      aborted: false,
      onAbort() {},
      sleep: async () => {
        sleeps += 1;
        if (sleeps > 1) {
          sink.aborted = true;
          return;
        }
        const [first] = await source.deps.sessionQueueEntriesService.listPendingBySession(running.id);
        await source.deps.sessionQueueEntriesService.removePending(first!.queue_position);
        await capture();
        await copyRecords();
        destination.deps.eventBus.emit("sessions", "set", { id: running.id });
        await new Promise(() => {});
      },
      write: async (event: string, data: unknown) => {
        frames.push({ event, data });
      },
    };
    await streamPersonalSession(running.id, destination.deps, sink);
    const queued = frames.filter((frame) => frame.event === "queued_messages").map((frame) => frame.data);
    expect(queued.map((data) => prompts(data as QueuedMessages)[0])).toEqual([
      "Then update the changelog.",
      `${"x".repeat(maxSharedQueuePrompt - 1)}🙂…`,
    ]);
  } finally {
    await source.close();
    await destination.close();
  }
});
