import { afterAll, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createProjectsService } from "../projects/projects";
import { createTagsService } from "./tags";

let close: () => Promise<void>;
let service: ReturnType<typeof createTagsService>;
let projectId: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  service = createTagsService(result.db);

  const projectsService = createProjectsService(result.db);
  const project = await projectsService.create({ name: "test-project" });
  projectId = project.id;
};

afterAll(async () => {
  await close?.();
});

test("list returns default tags seeded on project creation", async () => {
  await setup();

  const tags = await service.list(projectId);
  expect(tags.length).toBe(3);
  const names = tags.map((t) => t.name);
  expect(names).toContain("bug");
  expect(names).toContain("feature");
  expect(names).toContain("documentation");
});

test("create adds a new tag", async () => {
  const created = await service.create({ project_id: projectId, name: "urgent", color: "red" });

  expect(created.name).toBe("urgent");
  expect(created.color).toBe("red");

  const tags = await service.list(projectId);
  expect(tags.length).toBe(4);
});

test("getByName returns a tag", async () => {
  const tag = await service.getByName(projectId, "bug");
  expect(tag).not.toBeNull();
  expect(tag!.name).toBe("bug");
});

test("getByName returns null for non-existent tag", async () => {
  const tag = await service.getByName(projectId, "nonexistent");
  expect(tag).toBeNull();
});

test("softDelete hides tag from list", async () => {
  const urgent = await service.getByName(projectId, "urgent");
  expect(urgent).not.toBeNull();

  await service.softDelete(urgent!.id);

  const after = await service.list(projectId);
  expect(after.find((t) => t.name === "urgent")).toBeUndefined();
});
