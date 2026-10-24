import { afterAll, beforeAll, expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";

let handle: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  handle = await createTestApp();
});
afterAll(async () => {
  await handle?.close();
});

test("the project API lists recovery points and restores a deleted ticket through the same command used by clients", async () => {
  const res = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "Recovery" })),
  });
  expect(res.status).toBe(201);
  const project = await res.json();
  await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: "Example",
    extensionId: "example",
    installName: "example",
    manifest: {},
    name: "example",
    projectId: project.id,
    sourcePath: "/builtin/example",
  });
  const recovery = handle.deps.extensionStorageService.recovery;
  const storage = await handle.deps.extensionStorageService.open({
    owner: { workbenchId: project.id, extensionId: "example" },
  });
  await storage.records.commit({ operationId: "seed", edits: [{ recordId: "ticket", replace: "Saved ticket" }] });
  await recovery.capture(project.id);
  const listed = await handle.app.request(`/v1/projects/${project.id}/recovery-points`);
  expect(listed.status).toBe(200);
  const [target] = await listed.json();
  await storage.records.commit({ operationId: "delete", edits: [{ recordId: "ticket", deleted: true }] });
  const restored = await handle.app.request(`/v1/projects/${project.id}/restore`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hours: target.hours, capturedAt: target.capturedAt, extensionId: "example" }),
  });
  expect(restored.status).toBe(200);
  expect(await restored.json()).toEqual({ extensions: ["example"], records: 1 });
  expect((await storage.records.read("ticket")).value).toBe("Saved ticket");
  const stale = await handle.app.request(`/v1/projects/${project.id}/restore`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hours: target.hours, capturedAt: target.capturedAt }),
  });
  expect(stale.status).toBe(409);
});

test("recovery endpoints reject missing projects and unsupported recovery periods", async () => {
  expect((await handle.app.request("/v1/projects/missing/recovery-points")).status).toBe(404);
  expect(
    (
      await handle.app.request("/v1/projects/missing/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours: 30, capturedAt: "2026-10-20T00:00:00Z" }),
      })
    ).status,
  ).toBe(400);
});
