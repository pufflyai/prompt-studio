import { afterEach, beforeEach, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "./projects";

let close: () => Promise<void>;
let db: Awaited<ReturnType<typeof createDb>>["db"];
let projects: ReturnType<typeof createProjectsDBService>;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
  projects = createProjectsDBService(db);
};

beforeEach(async () => {
  await setup();
});

afterEach(async () => {
  await close?.();
});

test("projects service supports basic CRUD", async () => {
  const created = await projects.create({ name: "Alpha" });

  expect(typeof created.id).toBe("string");
  expect(created.name).toBe("Alpha");
  expect(created.shorthand).toBe("A");
  expect(created.created_at).toBeTruthy();
  expect(created.updated_at).toBeTruthy();

  const fetched = await projects.get(created.id);
  expect(fetched).toEqual(created);

  const list = await projects.list();
  expect(list).toHaveLength(1);

  const updated = await projects.update(created.id, { name: "Beta" });
  expect(updated?.name).toBe("Beta");
  expect(updated?.shorthand).toBe("A");

  const removed = await projects.remove(created.id);
  expect(removed).toBe(true);
  expect(await projects.get(created.id)).toBeNull();
});

test("projects setDefaults persists default agent and model", async () => {
  const project = await projects.create({ name: "Defaults" });
  expect(project.default_agent_id).toBeNull();
  expect(project.default_agent_model).toBeNull();

  const updated = await projects.setDefaults(project.id, {
    default_agent_id: "claude-code",
    default_agent_model: "claude-3-5-sonnet",
  });

  expect(updated?.default_agent_id).toBe("claude-code");
  expect(updated?.default_agent_model).toBe("claude-3-5-sonnet");

  const cleared = await projects.setDefaults(project.id, {
    default_agent_id: null,
    default_agent_model: null,
  });

  expect(cleared?.default_agent_id).toBeNull();
  expect(cleared?.default_agent_model).toBeNull();
});

test("projects setDefaults returns null when project missing", async () => {
  const result = await projects.setDefaults("missing", { default_agent_id: "claude-code" });
  expect(result).toBeNull();
});
