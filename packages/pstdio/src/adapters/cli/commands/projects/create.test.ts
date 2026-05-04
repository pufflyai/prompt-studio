import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler, resolveProjectName, resolveRepoPaths, validateRepoPaths } from "./create";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("resolveProjectName", () => {
  test("returns explicit name when provided", () => {
    expect(resolveProjectName("/work/prompt-studio", "my-project")).toBe("my-project");
  });

  test("uses folder name when missing", () => {
    expect(resolveProjectName("/work/prompt-studio")).toBe("prompt-studio");
  });

  test("uses folder name when name is blank", () => {
    expect(resolveProjectName("/work/prompt-studio", "   ")).toBe("prompt-studio");
  });
});

describe("resolveRepoPaths", () => {
  test("returns explicit repo paths when --repo is given", () => {
    const result = resolveRepoPaths(["/a", "/b"], "/work", () => "/work");
    expect(result).toEqual(["/a", "/b"]);
  });

  test("returns [gitRoot] when --repo omitted and inside a git repo", () => {
    const result = resolveRepoPaths(undefined, "/work/my-repo", () => "/work/my-repo");
    expect(result).toEqual(["/work/my-repo"]);
  });

  test("returns [] when --repo omitted and not inside a git repo", () => {
    const result = resolveRepoPaths(undefined, "/work/no-repo", () => null);
    expect(result).toEqual([]);
  });
});

describe("validateRepoPaths", () => {
  test("throws when a repo path is not a git repo", () => {
    expect(() => validateRepoPaths(["/not-a-repo"], () => null)).toThrow("Not a git repository: /not-a-repo");
  });

  test("does not throw for valid paths", () => {
    expect(() => validateRepoPaths(["/valid-repo"], () => "/valid-repo")).not.toThrow();
  });

  test("does not throw for empty array", () => {
    expect(() => validateRepoPaths([], () => null)).not.toThrow();
  });
});

describe("createHandler", () => {
  test("creates project with auto-detected repo when inside git repo", async () => {
    const createAndInitProject = mock(async (_root: string, _name: string, _opts?: unknown) => ({
      id: "proj-1",
      name: "prompt-studio",
      shorthand: "PS",
      selected_agents: [],
      default_agent_id: null,
      default_agent_model: null,
      startup_script: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
    }));
    const handler = createHandler({
      cwd: () => "/work/prompt-studio",
      findGitRoot: () => "/work/prompt-studio",
      createAndInitProject,
    });
    const log = mock(() => {});
    console.log = log as typeof console.log;

    await handler({} as never);

    expect(createAndInitProject).toHaveBeenCalledWith("/work/prompt-studio", "prompt-studio", {
      repoPaths: ["/work/prompt-studio"],
    });
    expect(log).toHaveBeenCalledWith(
      'Created project "prompt-studio" (proj-1) and initialized .pstdio at /work/prompt-studio',
    );
  });

  test("creates project with no repos when not in git repo and no --repo given", async () => {
    const createAndInitProject = mock(async (_root: string, _name: string, _opts?: unknown) => ({
      id: "proj-2",
      name: "my-project",
      shorthand: "MP",
      selected_agents: [],
      default_agent_id: null,
      default_agent_model: null,
      startup_script: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
    }));
    const handler = createHandler({
      cwd: () => "/work/my-project",
      findGitRoot: () => null,
      createAndInitProject,
    });
    const log = mock(() => {});
    console.log = log as typeof console.log;

    await handler({} as never);

    expect(createAndInitProject).toHaveBeenCalledWith("/work/my-project", "my-project", { repoPaths: [] });
  });

  test("creates project with specified --repo paths", async () => {
    const createAndInitProject = mock(async (_root: string, _name: string, _opts?: unknown) => ({
      id: "proj-3",
      name: "multi",
      shorthand: "M",
      selected_agents: [],
      default_agent_id: null,
      default_agent_model: null,
      startup_script: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
    }));
    const handler = createHandler({
      cwd: () => "/work/multi",
      findGitRoot: (dir: string) => dir,
      createAndInitProject,
    });
    const log = mock(() => {});
    console.log = log as typeof console.log;

    await handler({ repo: ["/repo-a", "/repo-b"] } as never);

    expect(createAndInitProject).toHaveBeenCalledWith("/work/multi", "multi", {
      repoPaths: ["/repo-a", "/repo-b"],
    });
  });

  test("uses git root as init directory when cwd is a subdirectory", async () => {
    const createAndInitProject = mock(async (_root: string, _name: string, _opts?: unknown) => ({
      id: "proj-4",
      name: "prompt-studio",
      shorthand: "PS",
      selected_agents: [],
      default_agent_id: null,
      default_agent_model: null,
      startup_script: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
    }));
    const handler = createHandler({
      cwd: () => "/work/prompt-studio/packages/cli",
      findGitRoot: () => "/work/prompt-studio",
      createAndInitProject,
    });
    const log = mock(() => {});
    console.log = log as typeof console.log;

    await handler({} as never);

    expect(createAndInitProject).toHaveBeenCalledWith("/work/prompt-studio", "prompt-studio", {
      repoPaths: ["/work/prompt-studio"],
    });
    expect(log).toHaveBeenCalledWith(
      'Created project "prompt-studio" (proj-4) and initialized .pstdio at /work/prompt-studio',
    );
  });

  test("throws when a --repo path is not a git repository", async () => {
    const handler = createHandler({
      cwd: () => "/work/project",
      findGitRoot: () => null,
      createAndInitProject: async () => ({
        id: "proj-1",
        name: "ignored",
        shorthand: "I",
        selected_agents: [],
        default_agent_id: null,
        default_agent_model: null,
        startup_script: null,
        created_at: "t",
        updated_at: "t",
        deleted_at: null,
      }),
    });

    await expect(handler({ repo: ["/not-a-repo"] } as never)).rejects.toThrow("Not a git repository: /not-a-repo");
  });
});
