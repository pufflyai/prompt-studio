import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resetApiClient } from "@/features/api-client";
import { installSkillsForAgent } from "./install-skills";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const TEST_PROJECT_ID = "test-project-123";

const SKILL_FIXTURES = [
  {
    name: "create-ticket",
    description: "Create a ticket",
    files: [
      { path: "SKILL.md", content: "---\nname: create-ticket\n---\nCreate ticket skill", encoding: "utf8" as const },
      { path: "templates/example.md", content: "# example", encoding: "utf8" as const },
    ],
  },
  {
    name: "refine-ticket",
    description: "Refine a ticket",
    files: [
      { path: "SKILL.md", content: "---\nname: refine-ticket\n---\nRefine ticket skill", encoding: "utf8" as const },
    ],
  },
  {
    name: "implement-ticket",
    description: "Implement a ticket",
    files: [
      {
        path: "SKILL.md",
        content: "---\nname: implement-ticket\n---\nImplement ticket skill",
        encoding: "utf8" as const,
      },
    ],
  },
];

const SKILL_NAMES = SKILL_FIXTURES.map((s) => s.name);

const toApiSkill = (s: (typeof SKILL_FIXTURES)[number]) => ({
  id: `id-${s.name}`,
  project_id: TEST_PROJECT_ID,
  name: s.name,
  description: s.description,
  files: s.files,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const CLAUDE_AGENT = {
  id: "pstdio.harness-claude-code.harness.claude-code",
  availability: { type: "INSTALLED" as const },
  skills: { dir: ".claude/skills", global_dir: ".claude/skills" },
};

const originalFetch = globalThis.fetch;

const getRequestDetails = (input: string | URL | Request, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : input.toString();
  return {
    path: new URL(url).pathname,
    method: init?.method ?? "GET",
  };
};

const jsonResponse = (body: unknown, status = 200) => {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
};

const getSkillResponse = (path: string) => {
  const skillMatch = path.match(/\/v1\/projects\/[^/]+\/skills\/(.+)/);
  if (!skillMatch) return null;

  const skill = SKILL_FIXTURES.find((fixture) => fixture.name === skillMatch[1]);
  return skill ? jsonResponse(toApiSkill(skill)) : jsonResponse({ error: "not found" }, 404);
};

const getSkillsListResponse = (path: string) => {
  if (!path.match(/\/v1\/projects\/[^/]+\/skills$/)) {
    return null;
  }

  return jsonResponse(SKILL_FIXTURES.map(toApiSkill));
};

const mockApi = (availableAgents: unknown[]) => {
  globalThis.fetch = mock((input: string | URL | Request, init?: RequestInit) => {
    const { path } = getRequestDetails(input, init);

    if (path === "/v1/agents/info") {
      return jsonResponse(availableAgents);
    }

    const skillResponse = getSkillResponse(path);
    if (skillResponse) return skillResponse;

    const skillsListResponse = getSkillsListResponse(path);
    if (skillsListResponse) return skillsListResponse;

    return jsonResponse({});
  }) as unknown as typeof fetch;
};

const setup = (name: string) => {
  const dir = join(tmpBase, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

beforeEach(() => {
  resetApiClient();
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClient();
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("installSkillsForAgent", () => {
  test("installs skills to project dir by default", async () => {
    mockApi([CLAUDE_AGENT]);
    const root = setup("agent-project");

    const installed = await installSkillsForAgent({
      root,
      agentId: "claude-code",

      projectId: TEST_PROJECT_ID,
    });

    expect(installed.length).toBe(SKILL_NAMES.length);
    for (const skill of SKILL_NAMES) {
      expect(existsSync(join(root, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
    }
  });

  test("installs skills to global dir when global is true", async () => {
    mockApi([CLAUDE_AGENT]);
    const fakeHome = setup("agent-global-home");

    const installed = await installSkillsForAgent({
      root: setup("unused-root"),
      agentId: "claude-code",

      projectId: TEST_PROJECT_ID,
      global: true,
      homedir: fakeHome,
    });

    expect(installed.length).toBe(SKILL_NAMES.length);
    for (const skill of SKILL_NAMES) {
      expect(existsSync(join(fakeHome, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
    }
  });

  test("returns only newly installed skill names", async () => {
    mockApi([CLAUDE_AGENT]);
    const root = setup("agent-partial");

    const existingSkillName = SKILL_FIXTURES[0].name;
    const existingSkillDir = join(root, ".claude", "skills", existingSkillName);
    mkdirSync(existingSkillDir, { recursive: true });
    writeFileSync(join(existingSkillDir, "SKILL.md"), "custom");

    const installed = await installSkillsForAgent({
      root,
      agentId: "claude-code",

      projectId: TEST_PROJECT_ID,
    });

    expect(installed).not.toContain(existingSkillName);
    expect(installed.length).toBe(SKILL_NAMES.length - 1);
  });

  test("throws for an unknown agent", async () => {
    mockApi([CLAUDE_AGENT]);
    const root = setup("unknown-agent");

    expect(
      installSkillsForAgent({
        root,
        agentId: "unknown",

        projectId: TEST_PROJECT_ID,
      }),
    ).rejects.toThrow("No installed harness found");
  });

  test("installs nothing for a harness without a skills layout", async () => {
    mockApi([{ id: "pstdio.extension-lab.harness.fake", availability: { type: "INSTALLED" as const } }]);
    const root = setup("no-skills-agent");

    const installed = await installSkillsForAgent({
      root,
      agentId: "fake",

      projectId: TEST_PROJECT_ID,
    });

    expect(installed).toEqual([]);
  });
});
