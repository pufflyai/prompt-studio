import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { runCommand } from "./run-command";

setDefaultTimeout(15_000);

describe("runCommand", () => {
  it("runs a command and captures trimmed output", async () => {
    const result = await runCommand("/tmp", ["echo", "  hello  "]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("");
  });

  it("returns spawn errors instead of hanging", async () => {
    const result = await runCommand("/tmp", ["definitely-not-a-real-command"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("captures stderr", async () => {
    const result = await runCommand("/tmp", ["sh", "-c", "echo warning >&2"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("warning");
  });

  it("returns non-zero exit code on failure", async () => {
    const result = await runCommand("/tmp", ["sh", "-c", "exit 42"]);

    expect(result.exitCode).toBe(42);
  });

  it("merges custom env with process env", async () => {
    const result = await runCommand("/tmp", ["sh", "-c", 'printf "%s" "$PSTDIO_RUN_COMMAND_TEST"'], {
      env: { PSTDIO_RUN_COMMAND_TEST: "custom-env" },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("custom-env");
    expect(result.stderr).toBe("");
  });

  it("preserves process env values when custom env is partial", async () => {
    const key = "PSTDIO_RUN_COMMAND_INHERITED";
    const previousValue = process.env[key];
    process.env[key] = "inherited-env";

    const result = await runCommand("/tmp", ["sh", "-c", 'printf "%s" "$PSTDIO_RUN_COMMAND_INHERITED"'], {
      env: { PSTDIO_RUN_COMMAND_TEST: "custom-env" },
    });

    if (previousValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previousValue;
    }

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("inherited-env");
    expect(result.stderr).toBe("");
  });
});
