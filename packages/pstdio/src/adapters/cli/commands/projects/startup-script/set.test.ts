import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./set";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("startup-script set", () => {
  test("sets script from file", async () => {
    const setStartupScript = mock(async () => {});
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getProject: mock(async () => ({ id: "proj-1", name: "my-app", shorthand: "MA", created_at: "", updated_at: "" })),
      setStartupScript,
      readFile: () => "bun install",
      readStdin: async () => "",
    });

    await handler({ file: "./setup.sh" } as never);

    expect(setStartupScript).toHaveBeenCalledWith(expect.any(String), "proj-1", "bun install");
    expect(log).toHaveBeenCalledWith('Startup script set for project "my-app".');
  });

  test("throws when not in a git repo", async () => {
    const handler = createHandler({
      cwd: () => "/nowhere",
      findGitRoot: () => null,
      readConfig: () => null,
      getProject: mock(async () => null),
      setStartupScript: mock(async () => {}),
      readFile: () => "",
      readStdin: async () => "",
    });

    await expect(handler({} as never)).rejects.toThrow("Not inside a git repository.");
  });

  test("throws when no project linked", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => null,
      getProject: mock(async () => null),
      setStartupScript: mock(async () => {}),
      readFile: () => "",
      readStdin: async () => "",
    });

    await expect(handler({} as never)).rejects.toThrow("Not inside a pstdio project.");
  });

  test("throws when file not found", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getProject: mock(async () => null),
      setStartupScript: mock(async () => {}),
      readFile: () => {
        throw new Error("ENOENT");
      },
      readStdin: async () => "",
    });

    await expect(handler({ file: "./missing.sh" } as never)).rejects.toThrow("File not found: ./missing.sh");
  });
});
