import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createNotificationsDBService } from "./notifications";

let db: DbClient;
let close: () => Promise<void>;
let notificationsService: ReturnType<typeof createNotificationsDBService>;
let projectId: string;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;
  notificationsService = createNotificationsDBService(db);

  const project = await createProjectsDBService(db).create({ name: "notifications-test" });
  projectId = project.id;
});

afterEach(async () => {
  await close();
});

describe("notifications service", () => {
  test("creates and lists open notifications by project", async () => {
    const created = await notificationsService.create({
      project_id: projectId,
      source: "api",
      origin: "core",
      title: "Review proposal",
      kind: "needs_review",
      priority: "high",
      target_json: { type: "ticket", id: "PS-95", label: "PS-95" },
      actions_json: [{ id: "open", label: "Review proposal", kind: "open-resource" }],
      dedupe_key: "planner:PS-95:review",
    });

    const listed = await notificationsService.list({ project_id: projectId });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({
      id: created.id,
      project_id: projectId,
      title: "Review proposal",
      status: "open",
      priority: "high",
      dedupe_key: "planner:PS-95:review",
    });
    expect(listed.nextCursor).toBeNull();
  });

  test("re-emitting a live dedupe key updates the existing row", async () => {
    const first = await notificationsService.create({
      project_id: projectId,
      source: "api",
      origin: "core",
      title: "First title",
      kind: "needs_review",
      priority: "normal",
      dedupe_key: "planner:PS-95:review",
    });

    await notificationsService.markRead(projectId, first.id);

    const updated = await notificationsService.create({
      project_id: projectId,
      source: "api",
      origin: "core",
      title: "Updated title",
      body: "New details",
      kind: "blocked",
      priority: "urgent",
      dedupe_key: "planner:PS-95:review",
    });

    const listed = await notificationsService.list({ project_id: projectId, status: ["open", "read"] });

    expect(updated.id).toBe(first.id);
    expect(updated).toMatchObject({
      title: "Updated title",
      body: "New details",
      kind: "blocked",
      priority: "urgent",
      status: "open",
    });
    expect(listed.items.map((item) => item.id)).toEqual([first.id]);
  });

  test("suppresses terminal dedupe re-emits inside the cooldown window", async () => {
    const first = await notificationsService.create({
      project_id: projectId,
      source: "api",
      origin: "core",
      title: "Done title",
      kind: "ready_to_merge",
      priority: "normal",
      dedupe_key: "planner:PS-95:merge",
    });

    await notificationsService.markDone(projectId, first.id);

    const suppressed = await notificationsService.create({
      project_id: projectId,
      source: "api",
      origin: "core",
      title: "Re-emitted title",
      kind: "ready_to_merge",
      priority: "normal",
      dedupe_key: "planner:PS-95:merge",
      terminalCooldownMs: 30_000,
    });

    const listed = await notificationsService.list({ project_id: projectId, status: ["done", "open"] });

    expect(suppressed.id).toBe(first.id);
    expect(suppressed.title).toBe("Done title");
    expect(listed.items).toHaveLength(1);
  });

  test("keeps terminal notifications terminal when stale actions run", async () => {
    const done = await notificationsService.create({
      project_id: projectId,
      source: "api",
      origin: "core",
      title: "Done",
      kind: "ready_to_merge",
    });
    const dismissed = await notificationsService.create({
      project_id: projectId,
      source: "api",
      origin: "core",
      title: "Dismissed",
      kind: "blocked",
    });

    await notificationsService.markDone(projectId, done.id);
    await notificationsService.dismiss(projectId, dismissed.id);

    await notificationsService.markRead(projectId, done.id);
    await notificationsService.snooze(projectId, done.id, "2000-01-01T00:00:00.000Z");
    await notificationsService.dismiss(projectId, done.id);
    await notificationsService.markDone(projectId, dismissed.id);
    await notificationsService.markRead(projectId, dismissed.id);
    await notificationsService.snooze(projectId, dismissed.id, "2000-01-01T00:00:00.000Z");

    const fetchedDone = await notificationsService.get(projectId, done.id);
    const fetchedDismissed = await notificationsService.get(projectId, dismissed.id);
    const woken = await notificationsService.wakeDueSnoozed("2026-01-01T00:00:00.000Z");

    expect(fetchedDone).toMatchObject({ status: "done", snoozed_until: null });
    expect(fetchedDone?.resolved_at).toBeString();
    expect(fetchedDismissed).toMatchObject({ status: "dismissed", snoozed_until: null });
    expect(fetchedDismissed?.resolved_at).toBeString();
    expect(woken.map((item) => item.id)).not.toContain(done.id);
    expect(woken.map((item) => item.id)).not.toContain(dismissed.id);
  });

  test("handles concurrent live dedupe re-emits without insert errors", async () => {
    const created = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        notificationsService.create({
          project_id: projectId,
          source: "api",
          origin: "core",
          title: `Concurrent title ${index}`,
          kind: "needs_review",
          priority: "normal",
          dedupe_key: "planner:PS-95:concurrent",
        }),
      ),
    );

    const ids = new Set(created.map((item) => item.id));
    const listed = await notificationsService.list({ project_id: projectId, status: ["open", "read", "snoozed"] });

    expect(ids.size).toBe(1);
    expect(listed.items.filter((item) => item.dedupe_key === "planner:PS-95:concurrent")).toHaveLength(1);
  });

  test("wakes due snoozed notifications", async () => {
    const created = await notificationsService.create({
      project_id: projectId,
      source: "api",
      origin: "core",
      title: "Wake me",
      kind: "info",
      priority: "normal",
    });

    await notificationsService.snooze(projectId, created.id, "2000-01-01T00:00:00.000Z");

    const woken = await notificationsService.wakeDueSnoozed("2026-01-01T00:00:00.000Z");
    const fetched = await notificationsService.get(projectId, created.id);

    expect(woken.map((item) => item.id)).toEqual([created.id]);
    expect(fetched).toMatchObject({ status: "open", snoozed_until: null });
  });
});
