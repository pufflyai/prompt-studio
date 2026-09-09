import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../test-utils/create-test-app";

test("domain mutations publish project, repository, file, and skill changes once", async () => {
  const root = mkdtempSync(join(tmpdir(), "mutation-events-"));
  const app = await createTestApp();
  const { eventBus, projectService, repoService, fileService, skillService } = app.deps;
  const events = () => eventBus.getSince(0);
  try {
    const project = await projectService.create({ name: "Mutation events" });
    expect(events().filter((event) => event.table === "projects")).toEqual([
      expect.objectContaining({ op: "set", data: project }),
    ]);
    const updated = await projectService.update(project.id, { name: "Updated" });
    expect(
      events()
        .filter((event) => event.table === "projects")
        .at(-1)?.data,
    ).toEqual(updated);
    const repo = await repoService.registerForProject(project.id, { name: "repo", path: root });
    const link = await repoService.getProjectRepoLink(project.id, repo.id);
    expect(events().filter((event) => event.table === "repos")).toHaveLength(1);
    expect(events().filter((event) => event.table === "project_repos")).toEqual([
      expect.objectContaining({ op: "set", data: link }),
    ]);
    await repoService.removeFromProject(project.id, repo.id);
    expect(
      events()
        .filter((event) => event.table === "project_repos")
        .at(-1),
    ).toMatchObject({
      op: "delete",
      data: { id: link!.id },
    });
    const file = await fileService.upload({
      project_id: project.id,
      file_name: "context.txt",
      file_kind: "session",
      data: Buffer.from("context"),
    });
    await fileService.update(file.id, { data: Buffer.from("updated") });
    await fileService.remove(file.id);
    expect(
      events()
        .filter((event) => event.table === "files")
        .map((event) => event.op),
    ).toEqual(["set", "set", "delete"]);
    const skill = await skillService.create({
      project_id: project.id,
      name: "example",
      description: "Example",
      files: [],
    });
    await skillService.setPreference(project.id, skill.name, { description: "Updated" });
    await skillService.remove(project.id, skill.name);
    expect(events().filter((event) => event.table === "skills")).toHaveLength(3);
    const count = events().length;
    expect(await fileService.remove(file.id)).toBe(false);
    expect(await projectService.update("missing", { name: "Missing" })).toBeNull();
    expect(events()).toHaveLength(count);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("failed initialization leaves no project or file mutation event", async () => {
  const app = await createTestApp();
  try {
    const { projectService, fileService, eventBus } = app.deps;
    await expect(
      projectService.create({ name: "Failed" }, async () => {
        throw new Error("initialize");
      }),
    ).rejects.toThrow("initialize");
    expect(eventBus.getSince(0).filter((event) => event.table === "projects")).toEqual([]);
    const project = await projectService.create({ name: "Files" });
    let fileId = "";
    await expect(
      fileService.upload(
        { project_id: project.id, file_name: "file.txt", file_kind: "extension", data: Buffer.from("file") },
        async (file) => {
          fileId = file.id;
          throw new Error("ownership");
        },
      ),
    ).rejects.toThrow("ownership");
    expect(await fileService.get(fileId)).toBeNull();
    expect(eventBus.getSince(0).filter((event) => event.table === "files")).toEqual([]);
  } finally {
    await app.close();
  }
});
