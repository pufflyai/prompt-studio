import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resetApiClient } from "@/features/api-client";
import { installDefaultSkills, installSkillsForAgent, removeInstalledSkillsForAgent } from "./install-default-skills";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const TEST_PROJECT_ID = "test-project-123";
const TEST_BASE_URL = "http://test:3000";

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

const originalFetch = globalThis.fetch;

const getRequestDetails = (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
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

const mockApi = (
  agents: { agent_id: string; is_default: boolean }[],
  options?: {
    availableAgents?: { id: string; availability: { type: "INSTALLED" | "NOT_FOUND" } }[];
    setupAvailableAgentsResponse?: { agent_id: string; is_default: boolean }[];
  },
) => {
  globalThis.fetch = mock((input: string | URL | Request, init?: RequestInit) => {
    const { path, method } = getRequestDetails(input, init);

    if (path === "/v1/agents" && method === "GET") {
      return jsonResponse(agents);
    }

    if (path === "/v1/agents/info") {
      return jsonResponse(options?.availableAgents ?? []);
    }

    if (path === "/v1/agents/setup-available" && method === "POST") {
      return jsonResponse(options?.setupAvailableAgentsResponse ?? [], 201);
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

const FAKE_HOME = join(tmpBase, "__fake-home__");

beforeEach(() => {
  resetApiClient();
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClient();
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("installDefaultSkills", () => {
  test("installs skills to claude-code dir when claude-code is configured", async () => {
    mockApi([{ agent_id: "claude-code", is_default: true }]);
    const root = setup("claude-agent");

    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, FAKE_HOME);

    for (const skill of SKILL_NAMES) {
      expect(existsSync(join(root, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
    }
    expect(existsSync(join(root, ".claude", "skills", "create-ticket", "templates", "example.md"))).toBe(true);
    expect(existsSync(join(root, ".agents", "skills"))).toBe(false);
  });

  test("installs skills to shared agent dir when opencode is configured", async () => {
    mockApi([{ agent_id: "opencode", is_default: true }]);
    const root = setup("opencode-agent");

    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, FAKE_HOME);

    for (const skill of SKILL_NAMES) {
      expect(existsSync(join(root, ".agents", "skills", skill, "SKILL.md"))).toBe(true);
    }
    expect(existsSync(join(root, ".claude", "skills"))).toBe(false);
  });

  test("installs skills to both dirs when both agents configured", async () => {
    mockApi([
      { agent_id: "claude-code", is_default: true },
      { agent_id: "opencode", is_default: false },
    ]);
    const root = setup("both-agents");

    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, FAKE_HOME);

    for (const skill of SKILL_NAMES) {
      expect(existsSync(join(root, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
      expect(existsSync(join(root, ".agents", "skills", skill, "SKILL.md"))).toBe(true);
    }
  });

  test("does nothing when no agents configured", async () => {
    mockApi([]);
    const root = setup("no-agents");

    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, FAKE_HOME);

    expect(existsSync(join(root, ".claude", "skills"))).toBe(false);
    expect(existsSync(join(root, ".agents", "skills"))).toBe(false);
  });

  test("configures the first available agent when none are set up yet", async () => {
    mockApi([], {
      availableAgents: [{ id: "claude-code", availability: { type: "INSTALLED" } }],
      setupAvailableAgentsResponse: [{ agent_id: "claude-code", is_default: true }],
    });
    const root = setup("auto-setup-agent");

    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, FAKE_HOME);

    for (const skill of SKILL_NAMES) {
      expect(existsSync(join(root, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
    }
    expect(existsSync(join(root, ".agents", "skills"))).toBe(false);
  });

  test("skips skills that already exist locally", async () => {
    mockApi([{ agent_id: "claude-code", is_default: true }]);
    const root = setup("skip-existing");

    const existingSkillDir = join(root, ".claude", "skills", "create-ticket");
    mkdirSync(existingSkillDir, { recursive: true });
    writeFileSync(join(existingSkillDir, "SKILL.md"), "custom content");

    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, FAKE_HOME);

    const content = readFileSync(join(existingSkillDir, "SKILL.md"), "utf8");
    expect(content).toBe("custom content");
  });

  test("is idempotent", async () => {
    mockApi([{ agent_id: "claude-code", is_default: true }]);
    const root = setup("idempotent");

    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, FAKE_HOME);
    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, FAKE_HOME);

    const skillFile = join(root, ".claude", "skills", "create-ticket", "SKILL.md");
    expect(existsSync(skillFile)).toBe(true);
  });

  test("skips local install when skill already exists globally", async () => {
    mockApi([{ agent_id: "claude-code", is_default: true }]);
    const root = setup("skip-global");
    const fakeHome = setup("fake-home-global");

    const globalSkillDir = join(fakeHome, ".claude", "skills", "create-ticket");
    mkdirSync(globalSkillDir, { recursive: true });
    writeFileSync(join(globalSkillDir, "SKILL.md"), "global version");

    await installDefaultSkills(root, TEST_PROJECT_ID, TEST_BASE_URL, fakeHome);

    expect(existsSync(join(root, ".claude", "skills", "create-ticket"))).toBe(false);

    const otherSkill = SKILL_NAMES.find((s) => s !== "create-ticket")!;
    expect(existsSync(join(root, ".claude", "skills", otherSkill, "SKILL.md"))).toBe(true);
  });
});

describe("installSkillsForAgent", () => {
  test("installs skills to project dir by default", async () => {
    mockApi([]);
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
    mockApi([]);
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
    mockApi([]);
    const root = setup("agent-partial");

    const existingSkillDir = join(root, ".claude", "skills", "create-ticket");
    mkdirSync(existingSkillDir, { recursive: true });
    writeFileSync(join(existingSkillDir, "SKILL.md"), "custom");

    const installed = await installSkillsForAgent({
      root,
      agentId: "claude-code",

      projectId: TEST_PROJECT_ID,
    });

    expect(installed).not.toContain("create-ticket");
    expect(installed.length).toBe(SKILL_NAMES.length - 1);
  });

  test("returns empty array for unknown agent", async () => {
    mockApi([]);
    const root = setup("unknown-agent");

    const installed = await installSkillsForAgent({
      root,
      agentId: "unknown",

      projectId: TEST_PROJECT_ID,
    });

    expect(installed).toEqual([]);
  });
});

describe("removeInstalledSkillsForAgent", () => {
  test("removes project skills and preserves user skills", async () => {
    mockApi([]);
    const root = setup("remove-installed");

    await installSkillsForAgent({
      root,
      agentId: "claude-code",

      projectId: TEST_PROJECT_ID,
    });

    // Add a user-created skill (not in the API)
    const userSkillDir = join(root, ".claude", "skills", "my-custom-skill");
    mkdirSync(userSkillDir, { recursive: true });
    writeFileSync(join(userSkillDir, "SKILL.md"), "user skill");

    const removed = await removeInstalledSkillsForAgent(root, "claude-code", TEST_PROJECT_ID);

    expect(removed.sort()).toEqual(SKILL_NAMES.sort());
    for (const skill of SKILL_NAMES) {
      expect(existsSync(join(root, ".claude", "skills", skill))).toBe(false);
    }
    expect(existsSync(join(userSkillDir, "SKILL.md"))).toBe(true);
  });

  test("returns empty array when no skills are installed", async () => {
    mockApi([]);
    const root = setup("remove-none");
    mkdirSync(join(root, ".claude", "skills"), { recursive: true });

    const removed = await removeInstalledSkillsForAgent(root, "claude-code", TEST_PROJECT_ID);

    expect(removed).toEqual([]);
  });

  test("returns empty array for unknown agent", async () => {
    mockApi([]);
    const root = setup("remove-unknown");

    const removed = await removeInstalledSkillsForAgent(root, "unknown", TEST_PROJECT_ID);

    expect(removed).toEqual([]);
  });
});
