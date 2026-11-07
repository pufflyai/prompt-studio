import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";

let fixture: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "project-composition-"));
  fixture = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
});
afterAll(async () => {
  await fixture?.close();
  if (root) await rm(root, { recursive: true, force: true });
});
const project = async () => {
  const response = await fixture.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "Composition" })),
  });
  expect(response.status).toBe(201);
  return response.json();
};
const save = (id: string, value: unknown) =>
  fixture.app.request(`/v1/projects/${id}/composition`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });

test("project composition stores explicit ordinary references in the existing synced project info", async () => {
  const p = await project();
  const configured = {
    defaultPage: { kind: "page", extensionId: "example.space", id: "desk" },
    resourceOpeners: [
      {
        resourceKind: { kind: "resource-kind", extensionId: "pstdio", id: "workspace" },
        opener: { kind: "command", extensionId: "example.space", id: "inspect" },
      },
    ],
  };
  expect((await save(p.id, configured)).status).toBe(200);
  const read = await fixture.app.request(`/v1/projects/${p.id}/composition`);
  expect(read.status).toBe(200);
  expect(await read.json()).toEqual(configured);
  expect(JSON.parse((await fixture.deps.projectInfoService.read(p.id)).composition!)).toEqual(configured);
  await fixture.deps.projectInfoService.write(p.id, { name: "Renamed" });
  expect(await (await fixture.app.request(`/v1/projects/${p.id}/composition`)).json()).toEqual(configured);
  const other = await project();
  expect(await (await fixture.app.request(`/v1/projects/${other.id}/composition`)).json()).not.toEqual(configured);
});

test("an explicit empty configuration persists instead of restoring distribution defaults", async () => {
  const p = await project();
  expect((await save(p.id, { defaultPage: null, resourceOpeners: [] })).status).toBe(200);
  expect(await (await fixture.app.request(`/v1/projects/${p.id}/composition`)).json()).toEqual({
    defaultPage: null,
    resourceOpeners: [],
  });
});

test("composition requires fully qualified references and one configured opener per resource kind", async () => {
  const p = await project();
  expect((await save(p.id, { defaultPage: { kind: "page", id: "desk" } })).status).toBe(400);
  const binding = {
    resourceKind: { kind: "resource-kind", extensionId: "example.data", id: "entry" },
    opener: { kind: "page", extensionId: "example.reader", id: "read" },
  };
  expect((await save(p.id, { resourceOpeners: [binding, binding] })).status).toBe(400);
  expect((await save("missing", {})).status).toBe(404);
});
