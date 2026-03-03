import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler, resolveProjectName } from "./create";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("resolveProjectName", () => {
  test("returns explicit name when provided", () => {
    expect(resolveProjectName("/work/prompt-studio", "my-project")).toBe("my-project");
  });

  test("uses git root folder name when missing", () => {
    expect(resolveProjectName("/work/prompt-studio")).toBe("prompt-studio");
  });

  test("uses git root folder name when name is blank", () => {
    expect(resolveProjectName("/work/prompt-studio", "   ")).toBe("prompt-studio");
  });
});

describe("createHandler", () => {
  test("creates project with derived name when omitted", async () => {
    const createAndInitProject = mock(async (_root: string, name: string) => ({ id: "proj-1", name }));
    const handler = createHandler({
      cwd: () => "/work/prompt-studio",
      findGitRoot: () => "/work/prompt-studio",
      createAndInitProject,
    });
    const log = mock(() => {});
    console.log = log as typeof console.log;

    await handler({} as never);

    expect(createAndInitProject).toHaveBeenCalledWith("/work/prompt-studio", "prompt-studio");
    expect(log).toHaveBeenCalledWith(
      'Created project "prompt-studio" (proj-1) and initialized .pstdio at /work/prompt-studio',
    );
  });

  test("throws when not inside a git repository", async () => {
    const handler = createHandler({
      cwd: () => "/work/not-a-repo",
      findGitRoot: () => null,
      createAndInitProject: async () => ({ id: "proj-1", name: "ignored" }),
    });

    await expect(handler({} as never)).rejects.toThrow("Not inside a git repository. Run `git init` first.");
  });
});
