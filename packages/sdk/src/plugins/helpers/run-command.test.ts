import { describe, expect, it } from "bun:test";
import { runCommand } from "./run-command";

describe("runCommand", () => {
  it("runs a command and captures trimmed output", async () => {
    const calls: { command: string[]; options: { cwd: string; stdout: string; stderr: string } }[] = [];
    const spawn = (command: string[], options: { cwd: string; stdout: string; stderr: string }) => {
      calls.push({ command, options });
      return {
        exited: Promise.resolve(12),
        stdout: new Response("  hello  \n").body,
        stderr: new Response("  warning  \n").body,
      };
    };

    const result = await runCommand(spawn, "/tmp/repo", ["bun", "run", "validate"]);

    expect(result).toEqual({ exitCode: 12, stdout: "hello", stderr: "warning" });
    expect(calls).toEqual([
      {
        command: ["bun", "run", "validate"],
        options: { cwd: "/tmp/repo", stdout: "pipe", stderr: "pipe" },
      },
    ]);
  });

  it("accepts Bun.spawn directly", () => {
    const spawn: Parameters<typeof runCommand>[0] = Bun.spawn;
    expect(typeof spawn).toBe("function");
  });
});
