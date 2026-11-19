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
  retainSession: () => () => {},
  list: async () => handles as never,
  get: async () => null,
  invalidate: () => {},
  dispose: async () => {},
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
    const projectHandle = handle({ skills: { dir: ".agents/skills", globalDir: ".agents/skills" } });
    const registry: HarnessRegistryService = {
      ...registryOf([]),
      list: async (options) => (options?.projectId === "p1" ? [projectHandle] : []),
    };

    expect(await listSkillAgents(registry, { projectId: "p1" })).toEqual([
      {
        id: "pstdio.harness-x.x",
        extensionId: "pstdio.harness-x",
        skillsDir: ".agents/skills",
        globalSkillsDir: ".agents/skills",
      },
    ]);
    expect(await listSkillAgents(registry)).toEqual([]);
  });
});
