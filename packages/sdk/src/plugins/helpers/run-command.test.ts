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

  it("captures stderr", async () => {
    const result = await runCommand("/tmp", ["sh", "-c", "echo warning >&2"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("warning");
  });

  it("returns non-zero exit code on failure", async () => {
    const result = await runCommand("/tmp", ["sh", "-c", "exit 42"]);

    expect(result.exitCode).toBe(42);
  });
});
