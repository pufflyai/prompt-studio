import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRunSetup, runSetup, runSetupScript, shellCommandFor } from "./setup";

let worktreePath: string;

beforeEach(async () => {
  worktreePath = await realpath(await mkdtemp(join(tmpdir(), "pstdio-wt-setup-test-")));
  await Bun.write(join(worktreePath, "README.md"), "# test repo\n");
});

afterEach(async () => {
  await rm(worktreePath, { recursive: true, force: true });
});

describe("runSetup", () => {
  test("hides Windows console windows when spawning setup commands", async () => {
    const calls: unknown[] = [];
    const runSetup = createRunSetup(((command: string[], options: unknown) => {
      calls.push({ command, options });
      return {
        exited: Promise.resolve(0),
        stderr: new Response("").body!,
        stdout: new Response("ok\n").body!,
      };
    }) as never);

    await expect(runSetup({ worktreePath, command: ["bun", "install"] })).resolves.toMatchObject({
      exitCode: 0,
      stdout: "ok\n",
      stderr: "",
    });

    expect(calls).toEqual([
      {
        command: ["bun", "install"],
        options: expect.objectContaining({
          cwd: worktreePath,
          stderr: "pipe",
          stdout: "pipe",
          windowsHide: true,
        }),
      },
    ]);
  });

  test("runs a command and captures output", async () => {
    const result = await runSetup({
      worktreePath,
      command: [process.execPath, "-e", "console.log('hello setup')"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello setup");
  });

  test("captures non-zero exit code", async () => {
    const result = await runSetup({
      worktreePath,
      command: [process.execPath, "-e", "process.exit(42)"],
    });

    expect(result.exitCode).toBe(42);
  });

  test("sets WORKTREE_PATH env var", async () => {
    const result = await runSetup({
      worktreePath,
      command: [process.execPath, "-e", "console.log(process.env.WORKTREE_PATH)"],
    });

    expect(result.stdout.trim()).toBe(worktreePath);
  });
});

describe("shellCommandFor", () => {
  test("uses sh -c off Windows", () => {
    expect(shellCommandFor("echo hi", "linux")).toEqual(["sh", "-c", "echo hi"]);
  });

  test("prefers a POSIX shell on Windows", () => {
    const command = shellCommandFor("echo hi", "win32", (name) => (name === "bash" ? "C:\\Git\\bin\\bash.exe" : null));
    expect(command).toEqual(["C:\\Git\\bin\\bash.exe", "-c", "echo hi"]);
  });

  test("falls back to cmd.exe when no POSIX shell is on PATH", () => {
    const command = shellCommandFor("echo hi", "win32", () => null);
    expect(command).toEqual([process.env.ComSpec ?? "cmd.exe", "/d", "/s", "/c", "echo hi"]);
  });
});

describe("runSetupScript", () => {
  test("runs a POSIX shell script string", async () => {
    const result = await runSetupScript({
      worktreePath,
      script: "echo 'from script' && ls README.md",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("from script");
    expect(result.stdout).toContain("README.md");
  });
});
