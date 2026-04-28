import { afterAll, describe, expect, test } from "bun:test";
import type { DbClient } from "pstdio-db";
import { createAgentConfigsDBService, createDb, createProjectsDBService } from "pstdio-db";
import { getFullState, SYNCED_TABLES } from "./get-full-state";

let close: () => Promise<void>;
let db: DbClient;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
};

afterAll(async () => {
  await close?.();
});

describe("getFullState", () => {
  test("returns all synced tables as keys", async () => {
    await setup();
    const state = await getFullState(db);

    for (const table of SYNCED_TABLES) {
      expect(state).toHaveProperty(table);
      expect(Array.isArray(state[table])).toBe(true);
    }
  });

  test("returns empty arrays for fresh database", async () => {
    await setup();
    const state = await getFullState(db);

    for (const table of SYNCED_TABLES) {
      expect(state[table]).toHaveLength(0);
    }
  });

  test("returns inserted data", async () => {
    await setup();

    const projectsService = createProjectsDBService(db);
    const agentConfigsService = createAgentConfigsDBService(db);

    await projectsService.create({ name: "test-project" });
    await agentConfigsService.upsert("claude-code");

    const state = await getFullState(db);

    expect(state.projects).toHaveLength(1);
    expect((state.projects[0] as Record<string, unknown>).name).toBe("test-project");

    expect(state.agent_configs).toHaveLength(1);
    expect((state.agent_configs[0] as Record<string, unknown>).agent_id).toBe("claude-code");
  });

  test("excludes soft-deleted rows", async () => {
    await setup();

    const projectsService = createProjectsDBService(db);

    const project = await projectsService.create({ name: "soft-delete-test" });
    await projectsService.remove(project.id);

    const state = await getFullState(db);

    expect((state.projects as { id: string }[]).find((row) => row.id === project.id)).toBeUndefined();
  });

  test("does not include ydoc tables", async () => {
    await setup();
    const state = await getFullState(db);

    expect(state).not.toHaveProperty("ydoc_updates");
    expect(state).not.toHaveProperty("ydoc_awareness");
    expect(state).not.toHaveProperty("ydoc_resume_state");
  });
});
