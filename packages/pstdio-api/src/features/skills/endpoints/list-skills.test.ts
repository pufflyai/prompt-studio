import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;
let bundledSkills: Awaited<ReturnType<typeof getBundledSkills>>;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-skills-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
  bundledSkills = await getBundledSkills();

  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Project" }),
  });
  const project = await res.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/projects/:id/skills", () => {
  test("lists seeded skills for a new project", async () => {
    const res = await app.request(`/v1/projects/${projectId}/skills`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });
});

describe("GET /v1/projects/:id/skills/:name", () => {
  test("returns skill metadata and content fields", async () => {
    const skill = bundledSkills[0];
    const res = await app.request(`/v1/projects/${projectId}/skills/${skill.name}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe(skill.name);
    expect(Array.isArray(body.files)).toBe(true);
    expect(body.files.length).toBeGreaterThan(0);
    expect(body.files[0].path).toBe("SKILL.md");
    expect(typeof body.bundled_version).toBe("string");
    expect(body.installed_agents).toEqual([]);
  });

  test("returns 404 for missing skill", async () => {
    const res = await app.request(`/v1/projects/${projectId}/skills/nonexistent`);
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/projects/:id/skills/:name/update", () => {
  test("updates an existing skill", async () => {
    const skill = bundledSkills[0];

    const res = await app.request(`/v1/projects/${projectId}/skills/${skill.name}/update`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe(skill.name);
    expect(Array.isArray(body.files)).toBe(true);
    expect(body.files.length).toBeGreaterThan(0);
  });

  test("returns 404 for missing skill", async () => {
    const res = await app.request(`/v1/projects/${projectId}/skills/nonexistent/update`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/projects/:id/skills/:name/update — repo propagation", () => {
  test("writes updated skill to agent directories in linked repos", async () => {
    const skill = bundledSkills[0];
    const repoPath = join(tempRoot, "repo");

    // Configure an agent
    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    // Register the repo for the project
    await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-repo", path: repoPath }),
    });

    // Write a stale skill tree to simulate an outdated agent directory
    const skillDir = join(repoPath, ".claude", "skills", skill.name);
    const staleFilePath = join(skillDir, "templates", "stale.md");
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, "templates"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# stale content", "utf8");
    writeFileSync(staleFilePath, "stale", "utf8");

    // Update the skill via the API
    const res = await app.request(`/v1/projects/${projectId}/skills/${skill.name}/update`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    // Verify the stale file was replaced.
    const updatedContent = readFileSync(join(skillDir, "SKILL.md"), "utf8");
    expect(updatedContent).not.toBe("# stale content");
    expect(existsSync(staleFilePath)).toBe(false);
  });
});

describe("GET /v1/projects/:id/skills/:name — installed_agents", () => {
  test("returns agent IDs where the skill is installed locally", async () => {
    const skill = bundledSkills[0];

    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Installed Agents Project" }),
    });
    const project = await projectRes.json();
    const isolatedRepoPath = join(tempRoot, "repo-installed-agents");

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "installed-agents-repo", path: isolatedRepoPath }),
    });

    const skillDir = join(isolatedRepoPath, ".claude", "skills", skill.name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# local install", "utf8");

    const res = await app.request(`/v1/projects/${project.id}/skills/${skill.name}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.installed_agents).toContain("claude-code");
  });
});

describe("POST /v1/projects/:id/skills/:name/update — installed_agents", () => {
  test("returns empty installed_agents when no repos are linked", async () => {
    const skill = bundledSkills[0];

    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Update No Repos Project" }),
    });
    const project = await projectRes.json();

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    const res = await app.request(`/v1/projects/${project.id}/skills/${skill.name}/update`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.installed_agents).toEqual([]);
  });

  test("returns empty installed_agents when only global skill copy exists", async () => {
    const skill = bundledSkills[0];

    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Update Global Only Project" }),
    });
    const project = await projectRes.json();
    const isolatedRepoPath = join(tempRoot, "repo-global-only");
    const globalSkillDir = join(homedir(), ".claude", "skills", skill.name);

    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "global-only-repo", path: isolatedRepoPath }),
    });

    rmSync(join(isolatedRepoPath, ".claude", "skills", skill.name), { recursive: true, force: true });

    mkdirSync(globalSkillDir, { recursive: true });
    writeFileSync(join(globalSkillDir, "SKILL.md"), "# global skill", "utf8");

    try {
      const res = await app.request(`/v1/projects/${project.id}/skills/${skill.name}/update`, {
        method: "POST",
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.installed_agents).toEqual([]);
    } finally {
      rmSync(globalSkillDir, { recursive: true, force: true });
    }
  });
});

describe("skill seeding idempotency", () => {
  test("creating a second project also seeds skill records", async () => {
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Second Project" }),
    });
    const project = await res.json();

    const listRes = await app.request(`/v1/projects/${project.id}/skills`);
    const skills = await listRes.json();
    expect(skills.length).toBeGreaterThan(0);
  });
});
