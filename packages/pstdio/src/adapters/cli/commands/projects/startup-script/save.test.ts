import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./save";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("startup-script save", () => {
  test("reads local .pstdio/startup.sh and sets remote startup script", async () => {
    const setStartupScript = mock(async () => {});
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      readLocalScript: () => "#!/usr/bin/env bash\necho hello",
      setStartupScript,
      clearStartupScript: mock(async () => {}),
    });

    await handler();

    expect(setStartupScript).toHaveBeenCalledWith(expect.any(String), "proj-1", "#!/usr/bin/env bash\necho hello");
    expect(log).toHaveBeenCalledWith("Saved .pstdio/startup.sh to project startup script");
  });

  test("clears remote startup script when local file is empty", async () => {
    const clearStartupScript = mock(async () => {});
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      readLocalScript: () => "   \n",
      setStartupScript: mock(async () => {}),
      clearStartupScript,
    });

    await handler();

    expect(clearStartupScript).toHaveBeenCalledWith(expect.any(String), "proj-1");
    expect(log).toHaveBeenCalledWith("Saved empty .pstdio/startup.sh and cleared project startup script");
  });

  test("throws when local startup script file is missing", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      readLocalScript: () => null,
      setStartupScript: mock(async () => {}),
      clearStartupScript: mock(async () => {}),
    });

    await expect(handler()).rejects.toThrow("Local startup script not found: .pstdio/startup.sh");
  });
});
