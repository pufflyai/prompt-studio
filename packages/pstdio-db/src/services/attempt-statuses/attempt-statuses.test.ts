import { afterAll, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createAttemptStatusesDBService } from "./attempt-statuses";

let close: () => Promise<void>;
let service: ReturnType<typeof createAttemptStatusesDBService>;
let projectId: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  service = createAttemptStatusesDBService(result.db);

  const projectsService = createProjectsDBService(result.db);
  const project = await projectsService.create({ name: "test-project" });
  projectId = project.id;
};

afterAll(async () => {
  await close?.();
});

test("update edits attempt status metadata", async () => {
  await setup();

  const running = await service.getByName(projectId, "wip");
  expect(running).not.toBeNull();

  const updated = await service.update(running!.id, { name: "in-progress", color: "purple", sort_order: 10 });

  expect(updated.name).toBe("in-progress");
  expect(updated.color).toBe("purple");
  expect(updated.sort_order).toBe(10);

  const found = await service.get(running!.id);
  expect(found!.name).toBe("in-progress");
  expect(found!.color).toBe("purple");
});

test("update handles is_default toggle", async () => {
  const blocked = await service.getByName(projectId, "blocked");
  expect(blocked).not.toBeNull();
  expect(blocked!.is_default).toBe(false);

  const updated = await service.update(blocked!.id, { is_default: true });
  expect(updated.is_default).toBe(true);

  // Previous default should be cleared
  const statuses = await service.list(projectId);
  const defaults = statuses.filter((s) => s.is_default);
  expect(defaults).toHaveLength(1);
  expect(defaults[0].id).toBe(blocked!.id);
});
