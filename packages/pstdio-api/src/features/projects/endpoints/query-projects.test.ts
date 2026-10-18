import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";

test("project queries page past fifty and preserve legacy field aliases", async () => {
  const { app, deps, close } = await createTestApp();
  try {
    for (let index = 0; index < 52; index++) await deps.projectService.create({ name: `Project ${index}` });
    const response = await app.request("/v1/projects/query");
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.items).toHaveLength(50);
    expect(first.items[0]).toMatchObject({
      createdAt: first.items[0].created_at,
      updatedAt: first.items[0].updated_at,
      defaultAgentId: null,
      defaultAgentModel: null,
      startupScript: null,
    });
    const last = await (await app.request(`/v1/projects/query?cursor=${first.nextCursor}`)).json();
    expect(last.items).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
    expect(new Set([...first.items, ...last.items].map((item) => item.id)).size).toBe(52);
    const legacy = await (await app.request("/v1/projects")).json();
    expect(legacy).toHaveLength(52);
    expect(legacy[0].createdAt).toBe(legacy[0].created_at);
  } finally {
    await close();
  }
});
