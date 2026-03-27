import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { ensureSkillsInstalled } from "./startup";

let app: OpenAPIHono<AppBindings>;
let deps: RouteDeps;
let tempRoot: string;
let repoPath: string;
let bundledSkills: Awaited<ReturnType<typeof getBundledSkills>>;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-skills-startup-test-"));
  repoPath = join(tempRoot, "repo");
  const result = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  });
  app = result.app;
  deps = result.deps;

  bundledSkills = await getBundledSkills();

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Startup Skills Project" }),
  });
  const project = await projectRes.json();

  await app.request("/v1/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: "claude-code" }),
  });

  await app.request(`/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoPath }),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("ensureSkillsInstalled", () => {
  test("installs missing skills to agent directories", async () => {
    const skill = bundledSkills[0];
    const skillPath = join(repoPath, ".claude", "skills", skill.name, "SKILL.md");

    expect(existsSync(skillPath)).toBe(true);

    // Remove the skill to simulate it being missing
    rmSync(join(repoPath, ".claude", "skills", skill.name), { recursive: true, force: true });
    expect(existsSync(skillPath)).toBe(false);

    await ensureSkillsInstalled(deps);

    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, "utf8")).toBe(skill.content);
  });

  test("does not overwrite existing skills", async () => {
    const skill = bundledSkills[0];
    const skillPath = join(repoPath, ".claude", "skills", skill.name, "SKILL.md");

    // Write custom content to simulate a user-modified skill
    const customContent = "# custom user skill";
    rmSync(join(repoPath, ".claude", "skills", skill.name), { recursive: true, force: true });
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(repoPath, ".claude", "skills", skill.name), { recursive: true });
    writeFileSync(skillPath, customContent, "utf8");

    await ensureSkillsInstalled(deps);

    // Should NOT overwrite
    expect(readFileSync(skillPath, "utf8")).toBe(customContent);
  });
});
