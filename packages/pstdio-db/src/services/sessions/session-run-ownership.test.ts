import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createSessionQueueEntriesDBService } from "../session-queue-entries/session-queue-entries";
import { createSessionsDBService } from "./sessions";

let close: () => Promise<void>;
let sessions: ReturnType<typeof createSessionsDBService>;
let queue: ReturnType<typeof createSessionQueueEntriesDBService>;
let projectId: string;

beforeEach(async () => {
  const connection = await createDb({ path: ":memory:" });
  close = connection.close;
  sessions = createSessionsDBService(connection.db);
  queue = createSessionQueueEntriesDBService(connection.db);
  projectId = (await createProjectsDBService(connection.db).create({ name: "Run ownership" })).id;
  setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
});

afterEach(async () => {
  setSystemTime();
  await close();
});

test("concurrent resumes advance run ownership while the clock is unchanged", async () => {
  const session = await sessions.create({ project_id: projectId, title: "Resume", agent: "test" });
  const resumed = await Promise.all(Array.from({ length: 3 }, () => sessions.updateStatus(session.id, "in_progress")));
  const starts = [session, ...resumed].map((row) => row!.last_request_started!);
  expect(new Set(starts).size).toBe(4);
  expect(starts).toEqual([...starts].sort());
  for (const start of starts.slice(0, -1)) {
    expect(await sessions.updateStatus(session.id, "failed", { expectedLastRequestStarted: start })).toBeNull();
  }
  expect(await sessions.get(session.id)).toMatchObject({ status: "in_progress", last_request_started: starts.at(-1) });
});

test("dispatch and recovery never reuse a prior run identity", async () => {
  const session = await sessions.create({ project_id: projectId, title: "Dispatch", agent: "test" });
  const { entry } = await sessions.queueExistingWithEntry({
    id: session.id,
    prompt: "Next",
    request_kind: "follow_up",
  });
  const first = await sessions.claimQueuedForDispatch(session.id, entry!.queue_position);
  await sessions.recoverQueuedDispatchClaim(session.id, entry!.queue_position);
  setSystemTime(new Date("2026-09-26T11:00:00.000Z"));
  const second = await sessions.claimQueuedForDispatch(session.id, entry!.queue_position);
  expect(first!.last_request_started! > session.last_request_started!).toBe(true);
  expect(second!.last_request_started! > first!.last_request_started!).toBe(true);
  expect(
    await sessions.updateStatus(session.id, "cancelled", { expectedLastRequestStarted: first!.last_request_started }),
  ).toBeNull();
  expect(await queue.get(entry!.queue_position)).not.toBeNull();
});

test("terminal updates remove queued work only when their run guard succeeds", async () => {
  const session = await sessions.create({ project_id: projectId, title: "Cancel", agent: "test" });
  await sessions.insertEntryForActive({ id: session.id, prompt: "Next", request_kind: "follow_up" });
  expect(await sessions.updateStatus(session.id, "cancelled", { expectedLastRequestStarted: null })).toBeNull();
  expect(await queue.listPendingBySession(session.id)).toHaveLength(1);
  expect(
    await sessions.updateStatus(session.id, "cancelled", { expectedLastRequestStarted: session.last_request_started }),
  ).toMatchObject({ status: "cancelled" });
  expect(await queue.listPendingBySession(session.id)).toHaveLength(0);
});

test("cancellation prevents a delayed follow-up from entering the queue", async () => {
  const session = await sessions.create({ project_id: projectId, title: "Cancel", agent: "test" });
  await sessions.updateStatus(session.id, "cancelled");
  expect(await sessions.insertEntryForActive({ id: session.id, prompt: "Late", request_kind: "follow_up" })).toBeNull();
  expect(await queue.listPendingBySession(session.id)).toHaveLength(0);
});

test.each([
  "completed",
  "failed",
  "disconnected",
] as const)("%s clears queued sessions but preserves active follow-ups", async (status) => {
  const queued = await sessions.createQueuedWithEntry({
    project_id: projectId,
    title: "Queued",
    agent: "test",
    prompt: "Next",
    request_kind: "start",
  });
  await sessions.updateStatus(queued.id, status);
  expect(await queue.listPendingBySession(queued.id)).toHaveLength(0);
  const active = await sessions.create({ project_id: projectId, title: "Active", agent: "test" });
  await sessions.insertEntryForActive({ id: active.id, prompt: "Next", request_kind: "follow_up" });
  await sessions.updateStatus(active.id, status);
  expect(await queue.listPendingBySession(active.id)).toHaveLength(1);
});
