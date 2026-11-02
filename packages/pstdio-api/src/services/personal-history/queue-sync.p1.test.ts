import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocumentStorage } from "pstdio-sync/records";
import { streamPersonalSession } from "../../features/sessions/endpoints/stream-personal-session";
import { createTestApp } from "../../test-utils/create-test-app";
import { createNativeStore } from "../account/native-store";
import { capturePersonalHistory } from "./capture";
import { maxSharedQueuePrompt, maxSharedQueueRequests } from "./queue-snapshot";
import { createHistoryReferences, historyReferenceName } from "./references";
import { createPersonalHistoryStore } from "./store";

const root = await mkdtemp(join(tmpdir(), "personal-queue-"));
afterAll(() => rm(root, { recursive: true, force: true }));

test("another device's queued messages are readable in order, bounded, and updated while the session is followed", async () => {
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
    await queue.create({
      session_id: running.id,
      prompt: "x".repeat(maxSharedQueuePrompt + 10),
      request_kind: "follow_up",
    });
    for (let index = 0; index < maxSharedQueueRequests; index++)
      await queue.create({ session_id: running.id, prompt: `Later ${index}`, request_kind: "follow_up" });

    const history = createPersonalHistoryStore({
      projectId: project.id,
      managerOrigin,
      accountId,
      documents: source.deps.extensionStorageService.documents,
    });
    const references = createHistoryReferences(
      source.deps.extensionStorageService.documents.open(historyReferenceName),
      project.id,
    );
    const device = { ownerId: accountId, id: "source-device", name: "Laptop" };
    const capture = () =>
      capturePersonalHistory({ projectId: project.id, device, history, references, deps: source.deps });
    const copyRecords = async () => {
      const store = (host: typeof source) =>
        createDocumentStorage({
          owner: history.owner,
          store: host.deps.extensionStorageService.documents.open("records"),
        });
      await store(destination).applyUpdate(await store(source).exportUpdate());
    };
    await capture();

    // A session without a queue keeps its record unchanged.
    const records = await history.readRecords("sessions");
    expect(records.find((row) => row.id === idle.id)).not.toHaveProperty("queue");

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
    const body = await response.json();
    expect(body.queue.requests).toHaveLength(maxSharedQueueRequests);
    expect(body.queue).toMatchObject({ steeringAvailable: false, steeringUnavailableReason: expect.any(String) });
    expect(body.messages[0]).toEqual({
      id: `queued-prompt-${running.id}-${body.queue.requests[0].queuePosition}`,
      role: "user",
      parts: [{ type: "text", text: "Then update the changelog." }],
    });
    expect(body.messages[1].parts[0].text).toHaveLength(maxSharedQueuePrompt + 1);
    expect(body.queue.requests.map((request: { queuePosition: number }) => request.queuePosition)).toEqual(
      [...body.queue.requests.map((request: { queuePosition: number }) => request.queuePosition)].sort((a, b) => a - b),
    );

    const followUps = await destination.app.request(`/v1/sessions/${running.id}/queued-follow-ups`);
    expect(followUps.status).toBe(200);
    expect((await followUps.json()).requests).toHaveLength(maxSharedQueueRequests);
    const idleQueue = await destination.app.request(`/v1/sessions/${idle.id}/queued-messages`);
    expect(await idleQueue.json()).toMatchObject({ messages: [], queue: { requests: [] } });

    // The queue never leaks into the synced session rows.
    const state = await destination.deps.syncService.getFullState();
    expect(state.sessions.find((row) => row.id === running.id)).not.toHaveProperty("queue");

    // A follower sees the queue at once, then each change the source device makes.
    const frames: { event: string; data: unknown }[] = [];
    let sleeps = 0;
    const sink = {
      aborted: false,
      onAbort() {},
      sleep: async () => {
        sleeps += 1;
        if (sleeps === 1) {
          const [first] = await source.deps.sessionQueueEntriesService.listUndispatchedBySession(running.id);
          await source.deps.sessionQueueEntriesService.removePending(first!.queue_position);
          await capture();
          await copyRecords();
          return;
        }
        sink.aborted = true;
      },
      write: async (event: string, data: unknown) => {
        frames.push({ event, data });
      },
    };
    await streamPersonalSession(running.id, destination.deps, sink);
    const queued = frames.filter((frame) => frame.event === "queued_messages");
    expect(queued).toHaveLength(2);
    const prompts = (frame: (typeof queued)[number]) =>
      (frame.data as { messages: { parts: { text: string }[] }[] }).messages.map((message) => message.parts[0]!.text);
    expect(prompts(queued[0]!)[0]).toBe("Then update the changelog.");
    expect(prompts(queued[1]!)[0]).not.toBe("Then update the changelog.");
  } finally {
    await source.close();
    await destination.close();
  }
});
