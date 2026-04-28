import { afterAll, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createAttemptStatusesDBService } from "../attempt-statuses/attempt-statuses";
import { createProjectsDBService } from "./projects";

let close: () => Promise<void>;
let projects: ReturnType<typeof createProjectsDBService>;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  projects = createProjectsDBService(result.db);
};

afterAll(async () => {
  await close?.();
});

test("projects service supports basic CRUD", async () => {
  await setup();

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

test("projects seed attempt statuses", async () => {
  const { db, close: close2 } = await createDb({ path: ":memory:" });
  const projectsService = createProjectsDBService(db);
  const seededProject = await projectsService.create({ name: "Seeded" });
  const statusesService = createAttemptStatusesDBService(db);
  const seededStatuses = await statusesService.list(seededProject.id);

  expect(seededStatuses.length).toBe(5);

  const wip = seededStatuses.find((status) => status.name === "wip");
  const reviewReady = seededStatuses.find((status) => status.name === "review-ready");

  expect(wip?.is_default).toBe(true);
  expect(reviewReady?.sort_order).toBeGreaterThan(wip?.sort_order ?? 0);

  await close2();
});
