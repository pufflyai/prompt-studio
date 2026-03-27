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

test("list returns default tag definitions seeded on project creation", async () => {
  await setup();

  const tags = await service.list(projectId);
  expect(tags.length).toBe(3);
  expect(tags.find((t) => t.name === "complexity")).toBeTruthy();
  expect(tags.find((t) => t.name === "label")).toBeTruthy();
  expect(tags.find((t) => t.name === "priority")).toBeTruthy();
});

test("listWithOptions returns tag definitions with nested options", async () => {
  const tags = await service.listWithOptions(projectId);
  expect(tags.length).toBe(3);

  const label = tags.find((t) => t.name === "label")!;
  expect(label.options.length).toBe(4);
  const optionNames = label.options.map((o) => o.name);
  expect(optionNames).toContain("bug");
  expect(optionNames).toContain("feature");
  expect(optionNames).toContain("documentation");
  expect(optionNames).toContain("chore");

  const bugOption = label.options.find((o) => o.name === "bug")!;
  expect(bugOption.icon).toBe("bug");

  const complexity = tags.find((t) => t.name === "complexity")!;
  expect(complexity.options.length).toBe(3);
  expect(complexity.options[0].icon).toBe("gauge");
});

test("create adds a new tag definition", async () => {
  const created = await service.create({
    project_id: projectId,
    name: "severity",
    type: "single_select",
  });

  expect(created.name).toBe("severity");
  expect(created.type).toBe("single_select");

  const tags = await service.list(projectId);
  expect(tags.length).toBe(4);
});

test("create with multi_select type", async () => {
  const created = await service.create({
    project_id: projectId,
    name: "components",
    type: "multi_select",
  });

  expect(created.type).toBe("multi_select");
});

test("update renames a tag definition", async () => {
  const tags = await service.list(projectId);
  const severity = tags.find((t) => t.name === "severity")!;

  await service.update(severity.id, { name: "impact" });

  const updated = await service.list(projectId);
  expect(updated.find((t) => t.name === "impact")).toBeTruthy();
  expect(updated.find((t) => t.name === "severity")).toBeUndefined();
});

test("remove deletes tag definition from list", async () => {
  const tags = await service.list(projectId);
  const components = tags.find((t) => t.name === "components")!;

  await service.remove(components.id);

  const after = await service.list(projectId);
  expect(after.find((t) => t.name === "components")).toBeUndefined();
});

test("createOption adds an option to a tag definition", async () => {
  const tags = await service.list(projectId);
  const label = tags.find((t) => t.name === "label")!;

  const option = await service.createOption({
    tag_id: label.id,
    name: "enhancement",
    color: "green",
  });

  expect(option.name).toBe("enhancement");
  expect(option.color).toBe("green");
  expect(option.tag_id).toBe(label.id);
});

test("listOptions returns options for a tag definition", async () => {
  const tags = await service.list(projectId);
  const label = tags.find((t) => t.name === "label")!;

  const options = await service.listOptions(label.id);
  expect(options.length).toBe(5);
  expect(options.find((o) => o.name === "enhancement")).toBeTruthy();
});

test("updateOption changes option name and color", async () => {
  const tags = await service.list(projectId);
  const label = tags.find((t) => t.name === "label")!;
  const options = await service.listOptions(label.id);
  const enhancement = options.find((o) => o.name === "enhancement")!;

  await service.updateOption(enhancement.id, { name: "improvement", color: "teal" });

  const updated = await service.listOptions(label.id);
  const improved = updated.find((o) => o.name === "improvement");
  expect(improved).toBeTruthy();
  expect(improved!.color).toBe("teal");
});

test("removeOption deletes option from list", async () => {
  const tags = await service.list(projectId);
  const label = tags.find((t) => t.name === "label")!;
  const options = await service.listOptions(label.id);
  const improvement = options.find((o) => o.name === "improvement")!;

  await service.removeOption(improvement.id);

  const after = await service.listOptions(label.id);
  expect(after.find((o) => o.name === "improvement")).toBeUndefined();
});

test("getByName returns a tag definition", async () => {
  const tag = await service.getByName(projectId, "label");
  expect(tag).not.toBeNull();
  expect(tag!.name).toBe("label");
  expect(tag!.type).toBe("single_select");
});

test("getByName returns null for non-existent tag", async () => {
  const tag = await service.getByName(projectId, "nonexistent");
  expect(tag).toBeNull();
});
