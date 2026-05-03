import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

type Harness = {
  app: OpenAPIHono<AppBindings>;
  close: () => Promise<void>;
  tempRoot: string;
  pstdioHome: string;
  repoPath: string;
};

const ORIGINAL_HOME = process.env.PSTDIO_HOME;

const writeExtensionLab = (pstdioHome: string) => {
  const extDir = join(pstdioHome, "extensions", "extension-lab");
  mkdirSync(join(extDir, "templates"), { recursive: true });
  mkdirSync(join(extDir, "skills", "lab-skill"), { recursive: true });

  writeFileSync(join(extDir, "templates", "lab-ticket.md"), "# Lab Ticket\nTemplate from extension lab.\n");
  writeFileSync(
    join(extDir, "skills", "lab-skill", "SKILL.md"),
    `---\nname: lab-skill\ndescription: "Lab skill."\n---\n\nLab skill body.\n`,
  );

  writeFileSync(
    join(extDir, "extension.ts"),
    `
const packageAsset = (path, baseUrl) => ({ kind: "package-asset", path, baseUrl });
export default {
  id: "pstdio.extension-lab",
  namespace: "lab",
  name: "Extension Lab",
  version: "0.1.0",
  templates: {
    labTicket: {
      title: "Lab Ticket",
      type: "ticket",
      source: packageAsset("./templates/lab-ticket.md", import.meta.url),
    },
  },
  skills: {
    lab: {
      title: "Lab Skill",
      source: packageAsset("./skills/lab-skill", import.meta.url),
    },
  },
};
`,
  );

  return extDir;
};

const createHarness = async (): Promise<Harness> => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-setup-test-"));
  const pstdioHome = join(tempRoot, "pstdio");
  const repoPath = join(tempRoot, "repo");
  mkdirSync(pstdioHome, { recursive: true });
  mkdirSync(repoPath, { recursive: true });
  process.env.PSTDIO_HOME = pstdioHome;

  writeExtensionLab(pstdioHome);

  const { app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: join(tempRoot, "files"),
  });

  return { app, close, tempRoot, pstdioHome, repoPath };
};

const createProject = async (app: OpenAPIHono<AppBindings>) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Extension Setup Project", agents: ["claude-code", "opencode"] }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).id as string;
};

const setupAgent = async (app: OpenAPIHono<AppBindings>, agentId: string) => {
  const res = await app.request("/v1/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: agentId }),
  });
  expect(res.status).toBe(201);
};

let harness: Harness | undefined;

beforeEach(async () => {
  harness = await createHarness();
});

afterEach(async () => {
  await harness?.close();
  if (harness) rmSync(harness.tempRoot, { recursive: true, force: true });
  harness = undefined;
  if (ORIGINAL_HOME === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = ORIGINAL_HOME;
});

describe("POST /v1/projects/:projectId/extensions/:installName/setup", () => {
  test("enables extension assets for a project and installs skills to enabled agents", async () => {
    const { app, repoPath } = harness!;
    const projectId = await createProject(app);
    await setupAgent(app, "claude-code");
    await setupAgent(app, "opencode");

    const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "repo", path: repoPath }),
    });
    expect(repoRes.status).toBe(201);

    const setupRes = await app.request(`/v1/projects/${projectId}/extensions/extension-lab/setup`, {
      method: "POST",
    });
    expect(setupRes.status).toBe(200);

    const templates = (await (await app.request(`/v1/projects/${projectId}/templates`)).json()) as {
      name: string;
      source_kind: string;
    }[];
    expect(templates).toContainEqual(
      expect.objectContaining({ name: "lab.labTicket", source_kind: "extension-default" }),
    );

    const skills = (await (await app.request(`/v1/projects/${projectId}/skills`)).json()) as {
      name: string;
      source_kind: string;
      installed_agents?: string[];
    }[];
    expect(skills).toContainEqual(
      expect.objectContaining({
        name: "lab.lab",
        source_kind: "extension-default",
        installed_agents: ["claude-code", "opencode"],
      }),
    );

    const claudeSkill = join(repoPath, ".claude", "skills", "lab.lab", "SKILL.md");
    const opencodeSkill = join(repoPath, ".opencode", "skills", "lab.lab", "SKILL.md");
    expect(existsSync(claudeSkill)).toBe(true);
    expect(existsSync(opencodeSkill)).toBe(true);
    expect(await readFile(claudeSkill, "utf8")).toContain("Lab skill body");
    expect(await readFile(opencodeSkill, "utf8")).toContain("Lab skill body");
  });
});
