import { afterAll, describe, expect, test } from "bun:test";
import type { DbClient } from "pstdio-db";
import { createAgentConfigsService, createDb, createProjectsService } from "pstdio-db";
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

    const projectsService = createProjectsService(db);
    const agentConfigsService = createAgentConfigsService(db);

    await projectsService.create({ name: "test-project" });
    await agentConfigsService.upsert("claude-code");

    const state = await getFullState(db);

    expect(state.projects).toHaveLength(1);
    expect((state.projects[0] as Record<string, unknown>).name).toBe("test-project");

    // project creation auto-creates 6 statuses + 3 tags
    expect(state.ticket_statuses).toHaveLength(6);
    expect(state.ticket_tags).toHaveLength(3);

    expect(state.agent_configs).toHaveLength(1);
    expect((state.agent_configs[0] as Record<string, unknown>).agent_id).toBe("claude-code");
  });

  test("does not include ydoc tables", async () => {
    await setup();
    const state = await getFullState(db);

    expect(state).not.toHaveProperty("ydoc_updates");
    expect(state).not.toHaveProperty("ydoc_awareness");
    expect(state).not.toHaveProperty("ydoc_resume_state");
  });
});
