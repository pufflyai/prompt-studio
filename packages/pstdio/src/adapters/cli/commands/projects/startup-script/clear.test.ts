import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./clear";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("startup-script clear", () => {
  test("clears the script and prints confirmation", async () => {
    const clearStartupScript = mock(async () => {});
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      clearStartupScript,
      getProject: mock(async () => ({ id: "proj-1", name: "my-app", shorthand: "MA", created_at: "", updated_at: "" })),
    });

    await handler();

    expect(clearStartupScript).toHaveBeenCalledWith(expect.any(String), "proj-1");
    expect(log).toHaveBeenCalledWith('Startup script cleared for project "my-app".');
  });

  test("throws when not in a git repo", async () => {
    const handler = createHandler({
      cwd: () => "/nowhere",
      findGitRoot: () => null,
      readConfig: () => null,
      clearStartupScript: mock(async () => {}),
      getProject: mock(async () => null),
    });

    await expect(handler()).rejects.toThrow("Not inside a git repository.");
  });

  test("throws when no project linked", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => null,
      clearStartupScript: mock(async () => {}),
      getProject: mock(async () => null),
    });

    await expect(handler()).rejects.toThrow("Not inside a pstdio project.");
  });
});
