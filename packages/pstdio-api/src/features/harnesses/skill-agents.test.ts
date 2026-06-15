import { describe, expect, test } from "bun:test";
import type { HarnessRegistryService } from "./harness-registry-service";
import { listSkillAgents } from "./skill-agents";

const handle = (overrides: Record<string, unknown>) =>
  ({
    id: "pstdio.harness-x.x",
    localId: "x",
    extensionId: "pstdio.harness-x",
    label: "X",
    skills: null,
    ...overrides,
  }) as never;

const registryOf = (handles: unknown[]): HarnessRegistryService => ({
  list: async () => handles as never,
  get: async () => null,
  invalidate: () => {},
});

describe("listSkillAgents", () => {
  test("returns only harnesses that declare skill directories", async () => {
    const registry = registryOf([
      handle({
        id: "pstdio.harness-a.a",
        extensionId: "pstdio.harness-a",
        skills: { dir: ".claude/skills", globalDir: ".claude/skills" },
      }),
      handle({ id: "pstdio.harness-b.b", extensionId: "pstdio.harness-b", skills: null }),
    ]);

    expect(await listSkillAgents(registry)).toEqual([
      {
        id: "pstdio.harness-a.a",
        extensionId: "pstdio.harness-a",
        skillsDir: ".claude/skills",
        globalSkillsDir: ".claude/skills",
      },
    ]);
  });

  test("scopes to a project when requested", async () => {
    const calls: unknown[] = [];
    const registry: HarnessRegistryService = {
      list: async (options) => {
        calls.push(options);
        return [];
      },
      get: async () => null,
      invalidate: () => {},
    };

    await listSkillAgents(registry, { projectId: "p1" });

    expect(calls).toEqual([{ projectId: "p1" }]);
  });
});
