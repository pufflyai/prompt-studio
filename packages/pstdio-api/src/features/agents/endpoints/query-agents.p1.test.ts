import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("agent and model catalogs page without assuming a small registry", async () => {
  const records = Array.from({ length: 52 }, (_, index) =>
    createTestHarnessRecord(`agent-${String(index).padStart(3, "0")}`, {
      provider: {
        listModels: () => Array.from({ length: 53 }, (_, model) => ({ id: `model-${String(model).padStart(3, "0")}` })),
      },
    }),
  );
  const disabled = records[0].id;
  const disabledByProject: Record<string, string[]> = {};
  const { app, close } = await createTestApp({
    harnessRegistry: createTestHarnessRegistry(records, { disabledByProject }),
  });
  try {
    const created = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Scoped catalog" })),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    disabledByProject[project.id] = [disabled];
    const response = await app.request(`/v1/agents/query?projectId=${project.id}`);
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.items).toHaveLength(50);
    expect(first.items.some((item: { id: string }) => item.id === disabled)).toBe(false);
    const last = await (
      await app.request(`/v1/agents/query?projectId=${project.id}&cursor=${first.nextCursor}`)
    ).json();
    expect(last.items).toHaveLength(1);
    expect(last.nextCursor).toBeNull();
    const modelsPath = `/v1/agents/${testHarnessId("agent-001")}/models/query?projectId=${project.id}`;
    const models = await (await app.request(modelsPath)).json();
    expect(models.items).toHaveLength(50);
    const modelsLast = await (await app.request(`${modelsPath}&cursor=${models.nextCursor}`)).json();
    expect(modelsLast.items).toHaveLength(3);
    expect(modelsLast.nextCursor).toBeNull();
    const availability = await app.request(
      `/v1/agents/availability?agent=${encodeURIComponent(disabled)}&projectId=${project.id}`,
    );
    expect(availability.status).toBe(200);
    expect(await availability.json()).toEqual({ type: "NOT_FOUND" });
    const canonical = await app.request(`/v1/agents/info?projectId=${project.id}`);
    expect(canonical.status).toBe(200);
    expect(await canonical.json()).toEqual(await (await app.request(`/v1/agents/info?project=${project.id}`)).json());
    expect((await app.request(`/v1/agents/info?projectId=${project.id}&project=other`)).status).toBe(400);
  } finally {
    await close();
  }
});
