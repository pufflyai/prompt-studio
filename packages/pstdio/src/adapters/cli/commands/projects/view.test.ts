import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler, type ViewArgs } from "./view";

const argv = (args: Partial<ViewArgs>) => ({ _: [], $0: "", ...args }) as Arguments<ViewArgs>;

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    cwd: () => "/fake/repo",
    findGitRoot: () => "/fake/repo",
    readConfig: () => ({ project_id: "proj-1" }),
    getProject: async () => ({
      id: "proj-1",
      name: "my-app",
      shorthand: "MA",
      selected_agents: [],
      default_agent_id: null,
      default_agent_model: null,
      startup_script: null,
      created_at: "2026-01-15T00:00:00.000Z",
      updated_at: "2026-01-20T12:00:00.000Z",
      deleted_at: null,
    }),
    listRepos: async () => [
      { id: "r1", name: "repo-1", path: "/p/repo-1", display_name: null, created_at: "", updated_at: "" },
      { id: "r2", name: "repo-2", path: "/p/repo-2", display_name: null, created_at: "", updated_at: "" },
    ],
    ...overrides,
    log,
  };
};

describe("projects view", () => {
  test("prints project details with repos", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ "project-id": undefined }));

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("my-app");
    expect(output).toContain("proj-1");
    expect(output).toContain("MA");
    expect(output).toContain("2026-01-15");
    expect(output).toContain("2026-01-20");
    expect(output).toContain("2 linked");
  });

  test("shows 'none' when no repos linked", async () => {
    const deps = makeDeps({ listRepos: async () => [] });
    const handler = createHandler(deps);

    await handler(argv({ "project-id": undefined }));

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("none");
  });

  test("uses --project-id flag when provided", async () => {
    const getProject = mock(async () => ({
      id: "other-id",
      name: "other",
      shorthand: "O",
      selected_agents: [],
      default_agent_id: null,
      default_agent_model: null,
      startup_script: null,
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
      deleted_at: null,
    }));
    const deps = makeDeps({ getProject });
    const handler = createHandler(deps);

    await handler(argv({ "project-id": "other-id" }));

    expect(getProject).toHaveBeenCalledWith("other-id");
  });

  test("throws when no project specified and no config", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps);

    expect(handler(argv({ "project-id": undefined }))).rejects.toThrow(
      "No project specified. Provide --project-id or run inside a linked project.",
    );
  });

  test("throws when project not found", async () => {
    const deps = makeDeps({ getProject: async () => null });
    const handler = createHandler(deps);

    expect(handler(argv({ "project-id": undefined }))).rejects.toThrow("Project not found: proj-1");
  });
});
