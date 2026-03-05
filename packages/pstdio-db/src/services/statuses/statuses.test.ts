import { afterAll, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsService } from "../projects/projects";
import { createStatusesService } from "./statuses";

let close: () => Promise<void>;
let service: ReturnType<typeof createStatusesService>;
let projectId: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  service = createStatusesService(result.db);

  const projectsService = createProjectsService(result.db);
  const project = await projectsService.create({ name: "test-project" });
  projectId = project.id;
};

afterAll(async () => {
  await close?.();
});

test("list returns default statuses seeded on project creation", async () => {
  await setup();

  const statuses = await service.list(projectId);
  expect(statuses.length).toBe(6);
  expect(statuses[0].name).toBe("backlog");
  expect(statuses[0].is_default).toBe(true);
});

test("create adds a new status with next sort_order", async () => {
  const created = await service.create({ project_id: projectId, name: "triaging", color: "teal" });

  expect(created.name).toBe("triaging");
  expect(created.sort_order).toBe(7); // 6 defaults + 1

  const statuses = await service.list(projectId);
  expect(statuses.length).toBe(7);
});

test("create with is_default unsets previous default", async () => {
  await service.create({ project_id: projectId, name: "new-default", color: "cyan", is_default: true });

  const statuses = await service.list(projectId);
  const defaults = statuses.filter((s) => s.is_default);
  expect(defaults.length).toBe(1);
  expect(defaults[0].name).toBe("new-default");
});

test("getByName returns a status", async () => {
  const status = await service.getByName(projectId, "backlog");
  expect(status).not.toBeNull();
  expect(status!.name).toBe("backlog");
});

test("getByName returns null for non-existent status", async () => {
  const status = await service.getByName(projectId, "nonexistent");
  expect(status).toBeNull();
});

test("setDefault changes the default status", async () => {
  const wip = await service.getByName(projectId, "wip");
  await service.setDefault(projectId, wip!.id);

  const statuses = await service.list(projectId);
  const defaults = statuses.filter((s) => s.is_default);
  expect(defaults.length).toBe(1);
  expect(defaults[0].name).toBe("wip");
});

test("softDelete hides status from list", async () => {
  const before = await service.list(projectId);
  const triaging = before.find((s) => s.name === "triaging");
  expect(triaging).not.toBeUndefined();

  await service.softDelete(triaging!.id);

  const after = await service.list(projectId);
  expect(after.find((s) => s.name === "triaging")).toBeUndefined();
});
