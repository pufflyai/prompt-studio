import { expect, test } from "bun:test";
import { WORKSPACES_COLLECTION_ID } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";

test("saved view queries page in configured order and preserve the separate default", async () => {
  const { app, deps, close } = await createTestApp();
  try {
    const project = await deps.projectService.create({ name: "Saved view pages" });
    const path = `/v1/projects/${project.id}/boards/${WORKSPACES_COLLECTION_ID}/views`;
    const initial = await (await app.request(path)).json();
    for (let index = 0; index < 52; index++) {
      expect(
        (
          await app.request(path, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: `Saved ${index}` }),
          })
        ).status,
      ).toBe(201);
    }
    const firstResponse = await app.request(`${path}/query`);
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json();
    expect(first.items).toHaveLength(50);
    const last = await (await app.request(`${path}/query?cursor=${first.nextCursor}`)).json();
    expect(last.items).toHaveLength(initial.views.length + 2);
    expect(last.nextCursor).toBeNull();
    expect(new Set([...first.items, ...last.items].map((item) => item.id)).size).toBe(initial.views.length + 52);
    const legacy = await (await app.request(path)).json();
    expect([...first.items, ...last.items]).toEqual(legacy.views);
    expect(legacy.defaultViewId).toBe(initial.defaultViewId);
  } finally {
    await close();
  }
});
