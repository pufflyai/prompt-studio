import { describe, expect, mock, test } from "bun:test";
import { exec } from "node:child_process";
import { runStartupScript } from "./run-startup-script";

describe("runStartupScript", () => {
  test("captures output and uploads log on success", async () => {
    const log = mock();
    const setStartupLog = mock(async () => ({ file_id: "f-1" }));

    await runStartupScript(
      { exec, log, setStartupLog },
      {
        script: 'echo "hello world"',
        cwd: process.cwd(),
        apiUrl: "http://localhost:3000",
        workspaceId: "ws-1",
        workspaceShorthand: "PS-1_A1",
      },
    );

    expect(log).toHaveBeenCalledWith("Running startup script...");
    expect(log).toHaveBeenCalledWith("Startup script completed.");
    expect(setStartupLog).toHaveBeenCalledTimes(1);
    expect(setStartupLog).toHaveBeenCalledWith("http://localhost:3000", "ws-1", expect.stringContaining("hello world"));
  });

  test("captures output and uploads log on failure", async () => {
    const log = mock();
    const setStartupLog = mock(async () => ({ file_id: "f-1" }));

    await runStartupScript(
      { exec, log, setStartupLog },
      {
        script: 'echo "error output" && exit 1',
        cwd: process.cwd(),
        apiUrl: "http://localhost:3000",
        workspaceId: "ws-1",
        workspaceShorthand: "PS-1_A1",
      },
    );

    expect(log).toHaveBeenCalledWith("Warning: startup script exited with code 1.");
    expect(log).toHaveBeenCalledWith("Startup log saved. View with: pstdio workspaces startup-log --id PS-1_A1");
    expect(setStartupLog).toHaveBeenCalledTimes(1);
  });

  test("handles upload failure gracefully", async () => {
    const log = mock();
    const setStartupLog = mock(async () => {
      throw new Error("upload failed");
    });

    await runStartupScript(
      { exec, log, setStartupLog },
      {
        script: 'echo "test"',
        cwd: process.cwd(),
        apiUrl: "http://localhost:3000",
        workspaceId: "ws-1",
        workspaceShorthand: "PS-1_A1",
      },
    );

    expect(log).toHaveBeenCalledWith("Warning: failed to save startup log.");
  });
});
