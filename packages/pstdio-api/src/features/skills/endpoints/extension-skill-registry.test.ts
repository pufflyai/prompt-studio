import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

const writeExtensionFixture = (repoPath: string) => {
  mkdirSync(join(repoPath, ".pstdio", "extensions"), { recursive: true });
  cpSync(
    join(import.meta.dirname, "../../../../../../.pstdio/extensions/extension-lab"),
    join(repoPath, ".pstdio", "extensions", "extension-lab"),
    { recursive: true },
  );
};

const createProject = async () => {
  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Extension Skill Registry" }),
  });
  return projectRes.json() as Promise<{ id: string }>;
};

const registerRepo = (projectId: string, repoPath: string) =>
  app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoPath }),
  });

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-extension-skill-registry-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension skill registry lifecycle", () => {
  test("lists, disables, enables, copies, and edits extension defaults without mutating the source asset", async () => {
    const project = await createProject();
    const repoPath = join(tempRoot, "extension-skill-repo");
    writeExtensionFixture(repoPath);
    expect((await registerRepo(project.id, repoPath)).status).toBe(201);

    const defaultName = "project.extension-lab.labSkill";
    const encodedDefaultName = encodeURIComponent(defaultName);

    const listRes = await app.request(`/v1/projects/${project.id}/skills`);
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as Array<{ name: string; source_kind?: string; read_only?: boolean }>;
    expect(listed).toContainEqual(
      expect.objectContaining({
        name: defaultName,
        source_kind: "extension-default",
        read_only: true,
      }),
    );

    const defaultRes = await app.request(`/v1/projects/${project.id}/skills/${encodedDefaultName}`);
    expect(defaultRes.status).toBe(200);
    const defaultSkill = (await defaultRes.json()) as { files: Array<{ path: string; content: string }> };
    expect(defaultSkill.files[0]?.path).toBe("SKILL.md");
    expect(defaultSkill.files[0]?.content.length).toBeGreaterThan(0);

    const updateDefaultRes = await app.request(`/v1/projects/${project.id}/skills/${encodedDefaultName}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "SKILL.md", content: "# should not save", encoding: "utf8" }],
      }),
    });
    expect(updateDefaultRes.status).toBe(400);

    expect(
      (
        await app.request(`/v1/projects/${project.id}/skills/${encodedDefaultName}/disable`, {
          method: "POST",
        })
      ).status,
    ).toBe(200);

    const disabledListRes = await app.request(`/v1/projects/${project.id}/skills`);
    const disabledList = (await disabledListRes.json()) as Array<{ name: string }>;
    expect(disabledList.some((skill) => skill.name === defaultName)).toBe(false);

    expect(
      (
        await app.request(`/v1/projects/${project.id}/skills/${encodedDefaultName}/enable`, {
          method: "POST",
        })
      ).status,
    ).toBe(200);

    const copyRes = await app.request(`/v1/projects/${project.id}/skills/${encodedDefaultName}/copy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "lab-skill-copy" }),
    });
    expect(copyRes.status).toBe(201);
    expect(await copyRes.json()).toMatchObject({
      name: "lab-skill-copy",
      source_kind: "project",
      read_only: false,
      origin_extension_id: "project.extension-lab",
      origin_skill_key: "labSkill",
    });

    const editRes = await app.request(`/v1/projects/${project.id}/skills/lab-skill-copy`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        description: "Edited variation",
        files: [{ path: "SKILL.md", content: "# Edited Variation", encoding: "utf8" }],
      }),
    });
    expect(editRes.status).toBe(200);

    const copiedRes = await app.request(`/v1/projects/${project.id}/skills/lab-skill-copy`);
    const copiedSkill = (await copiedRes.json()) as {
      read_only?: boolean;
      description: string;
      files: Array<{ content: string }>;
    };
    expect(copiedSkill.read_only).toBe(false);
    expect(copiedSkill.description).toBe("Edited variation");
    expect(copiedSkill.files[0]?.content).not.toBe(defaultSkill.files[0]?.content);

    const defaultAfterCopyRes = await app.request(`/v1/projects/${project.id}/skills/${encodedDefaultName}`);
    const defaultAfterCopy = (await defaultAfterCopyRes.json()) as { files: Array<{ content: string }> };
    expect(defaultAfterCopy.files[0]?.content).toBe(defaultSkill.files[0]?.content);
  });
});
