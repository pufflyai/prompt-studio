import { afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { resetApiClient } from "@/features/api-client";
import {
  installSkillsForAgent,
  removeInstalledSkillsForAgent,
  resolveSafeSkillFilePath,
} from "./install-default-skills";

const originalFetch = globalThis.fetch;

const maliciousSkill = {
  id: "id-evil",
  project_id: "project-1",
  name: "../escape",
  description: "evil",
  files: [{ path: "SKILL.md", content: "# evil", encoding: "utf8" as const }],
  installed_agents: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockMaliciousSkillApi = () => {
  globalThis.fetch = mock((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = new URL(url).pathname;

    if (path.match(/\/v1\/projects\/[^/]+\/skills$/)) {
      return Promise.resolve(new Response(JSON.stringify([maliciousSkill]), { status: 200 }));
    }

    return Promise.resolve(new Response(JSON.stringify(maliciousSkill), { status: 200 }));
  }) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClient();
});

describe("installSkillsForAgent security", () => {
  test("rejects traversal paths in skill files", async () => {
    const root = mkdtempSync(join(tmpdir(), "install-default-skills-security-"));

    try {
      resetApiClient();
      globalThis.fetch = mock((input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const path = new URL(url).pathname;

        if (path.match(/\/v1\/projects\/[^/]+\/skills$/)) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: "id-malicious",
                  project_id: "project-1",
                  name: "malicious-skill",
                  description: "bad",
                  files: [{ path: "SKILL.md", content: "# malicious", encoding: "utf8" }],
                  created_at: "2026-01-01T00:00:00Z",
                  updated_at: "2026-01-01T00:00:00Z",
                },
              ]),
              { status: 200 },
            ),
          );
        }

        if (path.endsWith("/skills/malicious-skill")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "id-malicious",
                project_id: "project-1",
                name: "malicious-skill",
                description: "bad",
                files: [
                  { path: "SKILL.md", content: "# malicious", encoding: "utf8" },
                  { path: "../escape.md", content: "escape", encoding: "utf8" },
                ],
                installed_agents: [],
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              }),
              { status: 200 },
            ),
          );
        }

        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      }) as unknown as typeof fetch;

      await expect(
        installSkillsForAgent({
          root,
          agentId: "claude-code",
          projectId: "project-1",
        }),
      ).rejects.toThrow("Invalid skill file path");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects path-traversal skill names during install", async () => {
    const root = mkdtempSync(join(tmpdir(), "install-default-skills-name-security-"));

    try {
      resetApiClient();
      mockMaliciousSkillApi();

      await expect(
        installSkillsForAgent({
          root,
          agentId: "claude-code",
          projectId: "project-1",
        }),
      ).rejects.toThrow(/Invalid skill name/);

      expect(existsSync(join(root, ".claude", "escape"))).toBe(false);
      expect(existsSync(join(root, "escape"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects path-traversal skill names during remove without deleting sibling dirs", async () => {
    const root = mkdtempSync(join(tmpdir(), "remove-installed-skills-name-security-"));

    try {
      resetApiClient();
      mockMaliciousSkillApi();

      const siblingDir = join(root, ".claude", "escape");
      mkdirSync(siblingDir, { recursive: true });
      writeFileSync(join(siblingDir, "important.txt"), "do not delete");
      mkdirSync(join(root, ".claude", "skills"), { recursive: true });

      await expect(removeInstalledSkillsForAgent(root, "claude-code", "project-1")).rejects.toThrow(
        /Invalid skill name/,
      );

      expect(existsSync(siblingDir)).toBe(true);
      expect(existsSync(join(siblingDir, "important.txt"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("accepts valid nested paths with win32 path semantics", () => {
    const resolved = resolveSafeSkillFilePath("C:\\repo\\.claude\\skills\\my-skill", "templates/example.md", {
      isAbsolute: win32.isAbsolute,
      relative: win32.relative,
      resolve: win32.resolve,
    });

    expect(resolved).toBe("C:\\repo\\.claude\\skills\\my-skill\\templates\\example.md");
  });
});
