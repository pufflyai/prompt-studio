import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mockFetch } from "@/test-utils/mock-fetch";
import { installDefaultSkills, installSkillsForAgent, removeBundledSkillsForAgent } from "./install-default-skills";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const mockAgents = (agents: { agent_id: string; is_default: boolean }[]) => {
  mockFetch(200, agents);
};

const setup = (name: string) => {
  const dir = join(tmpBase, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

// Use a non-existent homedir so the global skill check never interferes
const FAKE_HOME = join(tmpBase, "__fake-home__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

const EXPECTED_SKILLS = [
  "create-proposal",
  "create-sub-tickets",
  "create-ticket",
  "implement-ticket",
  "refine-ticket",
  "review-ticket",
  "update-documentation",
];

describe("installDefaultSkills", () => {
  test("installs skills to claude-code dir when claude-code is configured", async () => {
    mockAgents([{ agent_id: "claude-code", is_default: true }]);
    const root = setup("claude-agent");

    await installDefaultSkills(root, "http://test:3000", FAKE_HOME);

    for (const skill of EXPECTED_SKILLS) {
      expect(existsSync(join(root, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
    }
    expect(existsSync(join(root, ".opencode", "skills"))).toBe(false);
  });

  test("installs skills to opencode dir when opencode is configured", async () => {
    mockAgents([{ agent_id: "opencode", is_default: true }]);
    const root = setup("opencode-agent");

    await installDefaultSkills(root, "http://test:3000", FAKE_HOME);

    for (const skill of EXPECTED_SKILLS) {
      expect(existsSync(join(root, ".opencode", "skills", skill, "SKILL.md"))).toBe(true);
    }
    expect(existsSync(join(root, ".claude", "skills"))).toBe(false);
  });

  test("installs skills to both dirs when both agents configured", async () => {
    mockAgents([
      { agent_id: "claude-code", is_default: true },
      { agent_id: "opencode", is_default: false },
    ]);
    const root = setup("both-agents");

    await installDefaultSkills(root, "http://test:3000", FAKE_HOME);

    for (const skill of EXPECTED_SKILLS) {
      expect(existsSync(join(root, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
      expect(existsSync(join(root, ".opencode", "skills", skill, "SKILL.md"))).toBe(true);
    }
  });

  test("does nothing when no agents configured", async () => {
    mockAgents([]);
    const root = setup("no-agents");

    await installDefaultSkills(root, "http://test:3000", FAKE_HOME);

    expect(existsSync(join(root, ".claude", "skills"))).toBe(false);
    expect(existsSync(join(root, ".opencode", "skills"))).toBe(false);
  });

  test("skips skills that already exist locally", async () => {
    mockAgents([{ agent_id: "claude-code", is_default: true }]);
    const root = setup("skip-existing");

    const existingSkillDir = join(root, ".claude", "skills", "create-ticket");
    mkdirSync(existingSkillDir, { recursive: true });
    writeFileSync(join(existingSkillDir, "SKILL.md"), "custom content");

    await installDefaultSkills(root, "http://test:3000", FAKE_HOME);

    const content = readFileSync(join(existingSkillDir, "SKILL.md"), "utf8");
    expect(content).toBe("custom content");
  });

  test("is idempotent", async () => {
    mockAgents([{ agent_id: "claude-code", is_default: true }]);
    const root = setup("idempotent");

    await installDefaultSkills(root, "http://test:3000", FAKE_HOME);
    await installDefaultSkills(root, "http://test:3000", FAKE_HOME);

    const skillFile = join(root, ".claude", "skills", "create-ticket", "SKILL.md");
    expect(existsSync(skillFile)).toBe(true);
  });

  test("skips local install when skill already exists globally", async () => {
    mockAgents([{ agent_id: "claude-code", is_default: true }]);
    const root = setup("skip-global");
    const fakeHome = setup("fake-home-global");

    // Pre-install "create-ticket" globally with custom content
    const globalSkillDir = join(fakeHome, ".claude", "skills", "create-ticket");
    mkdirSync(globalSkillDir, { recursive: true });
    writeFileSync(join(globalSkillDir, "SKILL.md"), "global version");

    await installDefaultSkills(root, "http://test:3000", fakeHome);

    // "create-ticket" should NOT be installed locally (exists globally)
    expect(existsSync(join(root, ".claude", "skills", "create-ticket"))).toBe(false);

    // Other skills should still be installed locally
    expect(existsSync(join(root, ".claude", "skills", "review-ticket", "SKILL.md"))).toBe(true);
  });
});

describe("installSkillsForAgent", () => {
  test("installs skills to project dir by default", () => {
    const root = setup("agent-project");

    const installed = installSkillsForAgent({ root, agentId: "claude-code" });

    expect(installed.length).toBe(EXPECTED_SKILLS.length);
    for (const skill of EXPECTED_SKILLS) {
      expect(existsSync(join(root, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
    }
  });

  test("installs skills to global dir when global is true", () => {
    const fakeHome = setup("agent-global-home");

    const installed = installSkillsForAgent({
      root: setup("unused-root"),
      agentId: "claude-code",
      global: true,
      homedir: fakeHome,
    });

    expect(installed.length).toBe(EXPECTED_SKILLS.length);
    for (const skill of EXPECTED_SKILLS) {
      expect(existsSync(join(fakeHome, ".claude", "skills", skill, "SKILL.md"))).toBe(true);
    }
  });

  test("returns only newly installed skill names", () => {
    const root = setup("agent-partial");

    const existingSkillDir = join(root, ".claude", "skills", "create-ticket");
    mkdirSync(existingSkillDir, { recursive: true });
    writeFileSync(join(existingSkillDir, "SKILL.md"), "custom");

    const installed = installSkillsForAgent({ root, agentId: "claude-code" });

    expect(installed).not.toContain("create-ticket");
    expect(installed.length).toBe(EXPECTED_SKILLS.length - 1);
  });

  test("returns empty array for unknown agent", () => {
    const root = setup("unknown-agent");
    const installed = installSkillsForAgent({ root, agentId: "unknown" });
    expect(installed).toEqual([]);
  });
});

describe("removeBundledSkillsForAgent", () => {
  test("removes only bundled skills and preserves user skills", () => {
    const root = setup("remove-bundled");

    // Install bundled skills first
    installSkillsForAgent({ root, agentId: "claude-code" });

    // Add a user-created skill
    const userSkillDir = join(root, ".claude", "skills", "my-custom-skill");
    mkdirSync(userSkillDir, { recursive: true });
    writeFileSync(join(userSkillDir, "SKILL.md"), "user skill");

    const removed = removeBundledSkillsForAgent(root, "claude-code");

    expect(removed.sort()).toEqual(EXPECTED_SKILLS.sort());
    for (const skill of EXPECTED_SKILLS) {
      expect(existsSync(join(root, ".claude", "skills", skill))).toBe(false);
    }
    // User skill is preserved
    expect(existsSync(join(userSkillDir, "SKILL.md"))).toBe(true);
  });

  test("returns empty array when no bundled skills are installed", () => {
    const root = setup("remove-none");
    mkdirSync(join(root, ".claude", "skills"), { recursive: true });

    const removed = removeBundledSkillsForAgent(root, "claude-code");

    expect(removed).toEqual([]);
  });

  test("returns empty array for unknown agent", () => {
    const root = setup("remove-unknown");
    const removed = removeBundledSkillsForAgent(root, "unknown");
    expect(removed).toEqual([]);
  });
});
