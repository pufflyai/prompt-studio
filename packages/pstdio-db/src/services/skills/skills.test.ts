import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createSkillsDBService } from "./skills";

const nowTimestamp = () => new Date().toISOString();

let close: (() => Promise<void>) | undefined;
let svc: ReturnType<typeof createSkillsDBService>;
let projectId: string;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  svc = createSkillsDBService(result.db);

  projectId = crypto.randomUUID();
  const timestamp = nowTimestamp();
  await result.db
    .insert(projects)
    .values({ id: projectId, name: "Test", shorthand: "T", created_at: timestamp, updated_at: timestamp });
});

afterEach(async () => {
  await close?.();
});

describe("skillsService", () => {
  test("create and list skill files", async () => {
    const created = await svc.create({
      project_id: projectId,
      name: "create-pstdio-plugin",
      description: "Hook helpers",
      files: [
        { path: "SKILL.md", content: "# skill", encoding: "utf8" },
        { path: "references/example.md", content: "# ref", encoding: "utf8" },
      ],
    });

    expect(created.files).toHaveLength(2);
    expect(created.files[0]?.path).toBe("SKILL.md");

    const listed = await svc.list(projectId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.files.some((file) => file.path === "references/example.md")).toBe(true);
  });

  test("update replaces files and description", async () => {
    await svc.create({
      project_id: projectId,
      name: "create-pstdio-plugin",
      description: "Hook helpers",
      files: [{ path: "SKILL.md", content: "# skill", encoding: "utf8" }],
    });

    const updated = await svc.update(projectId, "create-pstdio-plugin", {
      description: "Updated hook helpers",
      files: [{ path: "SKILL.md", content: "# updated", encoding: "utf8" }],
    });

    expect(updated).not.toBeNull();
    expect(updated?.description).toBe("Updated hook helpers");
    expect(updated?.files).toEqual([{ path: "SKILL.md", content: "# updated", encoding: "utf8" }]);
  });

  test("remove soft deletes the skill", async () => {
    await svc.create({
      project_id: projectId,
      name: "create-pstdio-plugin",
      description: "Hook helpers",
      files: [{ path: "SKILL.md", content: "# skill", encoding: "utf8" }],
    });

    const removed = await svc.remove(projectId, "create-pstdio-plugin");
    expect(removed).toBe(true);

    const listed = await svc.list(projectId);
    expect(listed).toHaveLength(0);
  });
});
