import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { createNotifyApi } from "../../extensions/command-environment/notifications";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let server: ReturnType<typeof Bun.serve>;
let client: ReturnType<typeof createClient>;
let previousExtensions: string | undefined;
beforeAll(async () => {
  previousExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  handle = await createTestApp();
  server = Bun.serve({ port: 0, fetch: handle.app.fetch });
  client = createClient({ baseUrl: server.url.toString() });
});
afterAll(async () => {
  server?.stop(true);
  await handle?.close();
  if (previousExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousExtensions;
});
const project = async () => {
  const response = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "Notification status" })),
  });
  expect(response.status).toBe(201);
  return (await response.json()).id as string;
};
const notify = (projectId: string) =>
  createNotifyApi(handle.deps, {
    projectId,
    enabledSource: { installedSource: { id: "test.notifications" } },
  });

test("command and HTTP status calls share final transitions, idempotency and project scope", async () => {
  const projectId = await project();
  const otherProject = await project();
  const notification = await client.notifications.create({ projectId, title: "Review", kind: "needs_review" });
  const updates: unknown[] = [];
  const unsubscribe = handle.eventBus.subscribe((event) => {
    if (event.table === "notifications") updates.push(event);
  });
  try {
    const done = await notify(projectId).setStatus(notification.id, "done");
    expect(done).toMatchObject({ id: notification.id, status: "done" });
    expect(await client.notifications.setStatus(projectId, notification.id, { status: "done" })).toEqual(done);
    expect(updates).toHaveLength(1);
    const dismissed = await client.notifications.setStatus(projectId, notification.id, { status: "dismissed" });
    expect(dismissed).toMatchObject({ id: notification.id, status: "dismissed" });
    expect(await notify(projectId).setStatus(notification.id, "dismissed")).toEqual(dismissed);
    expect(updates).toHaveLength(2);
    expect(await notify(otherProject).setStatus(notification.id, "done")).toBeNull();
    expect(await client.notifications.setStatus(otherProject, notification.id, { status: "done" })).toBeNull();
    expect(await notify(projectId).setStatus("missing", "done")).toBeNull();
    expect(updates).toHaveLength(2);
  } finally {
    unsubscribe();
  }
});
test.each([
  "review/#?",
  "",
])("key status calls return the same group through commands, SDK and legacy resolve (%j)", async (key) => {
  const projectId = await project();
  const notification = await client.notifications.create({
    projectId,
    title: "Group",
    kind: "info",
    dedupeKey: key,
  });
  expect(await client.notifications.resolveByDedupeKey(projectId, { dedupeKey: key, status: "done" })).toMatchObject({
    resolved: 1,
    notifications: [expect.objectContaining({ id: notification.id, status: "done" })],
  });
  const command = await notify(projectId).setStatusByKey(key, "done");
  expect(command).toEqual([expect.objectContaining({ id: notification.id, status: "done" })]);
  expect(await client.notifications.setStatusByKey(projectId, key, { status: "done" })).toEqual(command);
  expect(await notify(projectId).resolve({ dedupeKey: key, status: "done" })).toEqual(command);
  expect(await client.notifications.setStatusByKey(projectId, "absent", { status: "dismissed" })).toEqual([]);
});
test("HTTP snoozing requires a time and authors cannot set host expiry", async () => {
  const projectId = await project();
  const notification = await client.notifications.create({ projectId, title: "Later", kind: "info" });
  const snoozedUntil = new Date(Date.now() + 60_000).toISOString();
  expect(
    await client.notifications.setStatus(projectId, notification.id, { status: "snoozed", snoozedUntil }),
  ).toMatchObject({ status: "snoozed", snoozedUntil });
  for (const body of [{ status: "snoozed" }, { status: "expired" }, { status: "done", snoozedUntil }]) {
    const response = await handle.app.request(`/v1/projects/${projectId}/notifications/${notification.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
  }
});
