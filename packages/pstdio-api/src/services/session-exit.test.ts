import { expect, test } from "bun:test";
import { createActivityEventsDBService, createDb, createProjectsDBService, createSessionsDBService } from "pstdio-db";
import { readSessionExit } from "./session-exit";

test("execution exits retain actual stop causes and cannot describe a newer run", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(db).create({ name: "Execution exits" });
    const activity = createActivityEventsDBService(db);
    const sessions = createSessionsDBService(db);
    const session = await sessions.create({ project_id: project.id, title: "Execution", agent: "test" });
    expect(await readSessionExit(activity, { ...session, project_id: project.id })).toBeNull();
    const stopped = (await sessions.updateStatus(session.id, "cancelled", { exitCause: "user_stop" }))!;
    expect(await readSessionExit(activity, { ...stopped, project_id: project.id })).toMatchObject({
      cause: "user_stop",
      endedAt: stopped.last_request_ended,
    });
    expect(
      await readSessionExit(activity, {
        ...stopped,
        project_id: project.id,
        last_request_started: "2026-10-13T10:00:00.000Z",
      }),
    ).toBeNull();
    const lost = (await sessions.updateStatus(session.id, "disconnected"))!;
    expect(await readSessionExit(activity, { ...lost, project_id: project.id })).toMatchObject({
      cause: "worker_lost",
    });
    const unknown = (await sessions.updateStatus(session.id, "cancelled"))!;
    expect(await readSessionExit(activity, { ...unknown, project_id: project.id })).toMatchObject({ cause: "unknown" });
  } finally {
    await close();
  }
});

test("same-run abort cleanup preserves explicit user stop evidence", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(db).create({ name: "Cancellation precedence" });
    const sessions = createSessionsDBService(db);
    const activity = createActivityEventsDBService(db);
    const session = await sessions.create({ project_id: project.id, title: "Owner", agent: "test" });
    await sessions.updateStatus(session.id, "cancelled", { exitCause: "user_stop" });
    const cleanup = (await sessions.updateStatus(session.id, "cancelled", {
      exitCause: "request_aborted",
      expectedLastRequestStarted: session.last_request_started,
    }))!;
    expect(await readSessionExit(activity, { ...cleanup, project_id: project.id })).toMatchObject({
      cause: "user_stop",
    });
  } finally {
    await close();
  }
});
