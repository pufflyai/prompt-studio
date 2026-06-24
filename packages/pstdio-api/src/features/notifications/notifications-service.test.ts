import { describe, expect, mock, test } from "bun:test";
import type { NotificationRecord } from "pstdio-db";
import type { NotificationsRouteDeps } from "./deps";
import { resolveByDedupeKey, transitionStatus } from "./notifications-service";

const createRow = (status: NotificationRecord["status"]): NotificationRecord => ({
  id: "notification-1",
  project_id: "project-1",
  source: "api",
  origin: "core",
  source_extension_id: null,
  actor_type: null,
  actor_id: null,
  title: "Approve proposal",
  body: null,
  kind: "approval_required",
  priority: "normal",
  status,
  target_json: null,
  related_json: [],
  actions_json: [],
  metadata_json: null,
  dedupe_key: "proposal:PS-95",
  created_at: "2026-06-24T10:00:00.000Z",
  updated_at: "2026-06-24T10:00:00.000Z",
  read_at: null,
  resolved_at: status === "done" ? "2026-06-24T10:01:00.000Z" : null,
  snoozed_until: null,
  expires_at: null,
});

const createDeps = (row: NotificationRecord) => {
  const update = mock(async (_projectId: string, _id: string, patch: Partial<NotificationRecord>) => ({
    ...row,
    ...patch,
    status: patch.status ?? row.status,
  }));
  const findById = mock(async () => row);
  const findLiveByDedupeKey = mock(async () =>
    row.status === "open" || row.status === "read" || row.status === "snoozed" ? row : null,
  );
  const createActivity = mock(async () => undefined);
  const emit = mock(() => undefined);

  return {
    deps: {
      notificationsService: {
        update,
        findById,
        findLiveByDedupeKey,
        create: mock(async () => row),
        list: mock(async () => ({ items: [], nextCursor: null })),
        count: mock(async () => 0),
        listDueSnoozed: mock(async () => []),
      },
      activityEventsService: { create: createActivity },
      eventBus: { emit },
      projectService: {},
    } as unknown as NotificationsRouteDeps,
    update,
    findById,
    createActivity,
    emit,
  };
};

describe("transitionStatus", () => {
  test("does not move terminal notifications back to live statuses", async () => {
    const { deps, update, createActivity, emit } = createDeps(createRow("done"));

    const result = await transitionStatus(deps, {
      projectId: "project-1",
      id: "notification-1",
      status: "read",
    });

    expect(result?.status).toBe("done");
    expect(update).not.toHaveBeenCalled();
    expect(createActivity).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("resolveByDedupeKey", () => {
  test("does not resolve terminal notifications by dedupe key", async () => {
    const { deps, update } = createDeps(createRow("done"));

    const result = await resolveByDedupeKey(deps, {
      projectId: "project-1",
      dedupeKey: "proposal:PS-95",
      status: "done",
    });

    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
