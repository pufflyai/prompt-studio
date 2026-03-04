import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./get";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("startup-script get", () => {
  test("prints the script content", async () => {
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getStartupScript: mock(async () => "bun install"),
    });

    await handler();

    expect(log).toHaveBeenCalledWith("bun install");
  });

  test("prints message when no script configured", async () => {
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getStartupScript: mock(async () => null),
    });

    await handler();

    expect(log).toHaveBeenCalledWith("No startup script configured.");
  });

  test("throws when not in a git repo", async () => {
    const handler = createHandler({
      cwd: () => "/nowhere",
      findGitRoot: () => null,
      readConfig: () => null,
      getStartupScript: mock(async () => null),
    });

    await expect(handler()).rejects.toThrow("Not inside a git repository.");
  });

  test("throws when no project linked", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => null,
      getStartupScript: mock(async () => null),
    });

    await expect(handler()).rejects.toThrow("Not inside a pstdio project.");
  });
});
