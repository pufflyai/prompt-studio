import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./pull";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("startup-script pull", () => {
  test("writes remote script to .pstdio/startup.sh", async () => {
    const writeLocalScript = mock(() => {});
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getStartupScript: mock(async () => "echo hello"),
      writeLocalScript,
      removeLocalScript: mock(() => false),
    });

    await handler();

    expect(writeLocalScript).toHaveBeenCalledWith("/repo", "echo hello");
    expect(log).toHaveBeenCalledWith("Pulled startup script to .pstdio/startup.sh");
  });

  test("removes local script when remote script is empty", async () => {
    const removeLocalScript = mock(() => true);
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getStartupScript: mock(async () => null),
      writeLocalScript: mock(() => {}),
      removeLocalScript,
    });

    await handler();

    expect(removeLocalScript).toHaveBeenCalledWith("/repo");
    expect(log).toHaveBeenCalledWith("Pulled empty startup script and removed .pstdio/startup.sh");
  });
});
