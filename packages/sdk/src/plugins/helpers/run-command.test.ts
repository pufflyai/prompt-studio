import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("accepts a custom env", async () => {
    const result = await runCommand("/tmp", ["/bin/sh", "-c", 'printf "%s" "$PSTDIO_RUN_COMMAND_TEST"'], {
      env: { PSTDIO_RUN_COMMAND_TEST: "custom-env" },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("custom-env");
    expect(result.stderr).toBe("");
  });

  it("picks up runtime changes to process.env", async () => {
    const key = "PSTDIO_RUN_COMMAND_RUNTIME_TEST";
    const previous = process.env[key];
    process.env[key] = "runtime-value";

    try {
      const result = await runCommand("/tmp", ["/bin/sh", "-c", `printf "%s" "$${key}"`]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("runtime-value");
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it("uses process environment updates when resolving commands", async () => {
    const binDir = mkdtempSync(join(tmpdir(), "pstdio-run-command-"));
    const commandPath = join(binDir, "pstdio-run-command-path-test");
    const previousPath = process.env.PATH;

    try {
      writeFileSync(commandPath, "#!/bin/sh\nprintf path-command\n");
      chmodSync(commandPath, 0o755);
      process.env.PATH = `${binDir}:${previousPath ?? ""}`;

      const result = await runCommand("/tmp", ["pstdio-run-command-path-test"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("path-command");
      expect(result.stderr).toBe("");
    } finally {
      if (previousPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousPath;
      }
      rmSync(binDir, { recursive: true, force: true });
    }
  });
});
