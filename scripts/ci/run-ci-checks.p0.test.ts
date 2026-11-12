import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCiChecks } from "./run-ci-checks";

const inheritedProfile = process.env.CI_PROFILE;
beforeEach(() => {
  delete process.env.CI_PROFILE;
});
afterEach(() => {
  if (inheritedProfile === undefined) delete process.env.CI_PROFILE;
  else process.env.CI_PROFILE = inheritedProfile;
});

test("an empty check plan cannot report successful validation", async () => {
  await expect(runCiChecks([], { priority: "P0" })).rejects.toThrow("No CI checks");
});

for (const priority of ["P0", "P2", "P3"] as const) {
  test(`${priority} runs every independent command after failures`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "ci-collect-"));
    try {
      const marker = join(directory, "finished");
      const result = await runCiChecks(
        [
          { id: "first", command: [process.execPath, "-e", "process.exit(2)"] },
          {
            id: "second",
            command: [process.execPath, "-e", `await Bun.write(${JSON.stringify(marker)}, 'done'); process.exit(3)`],
          },
        ],
        { priority, concurrency: 1 },
      );
      expect(result.outcome).toBe("failure");
      expect(result.results.map((check) => check.exitCode)).toEqual([2, 3]);
      expect(await readFile(marker, "utf8")).toBe("done");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test("P1 stops remaining commands and terminates active children", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ci-fail-fast-"));
  try {
    const marker = join(directory, "started");
    const checks = [
      {
        id: "active",
        command: [
          process.execPath,
          "-e",
          `await Bun.write(${JSON.stringify(marker)}, 'started'); await new Promise(resolve => setTimeout(resolve, 30000))`,
        ],
      },
      {
        id: "failure",
        command: [
          process.execPath,
          "-e",
          `while (!(await Bun.file(${JSON.stringify(marker)}).exists())) await Bun.sleep(5); process.exit(2)`,
        ],
      },
      { id: "pending", command: [process.execPath, "-e", "process.exit(0)"] },
    ];
    const result = await runCiChecks(checks, { priority: "P1", concurrency: 2 });
    expect(result.outcome).toBe("failure");
    expect(result.results.map((check) => check.outcome)).toEqual(["cancelled", "failure", "cancelled"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("P1 reaps an owned grandchild that ignores termination after its parent exits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ci-process-tree-"));
  const marker = join(directory, "grandchild.json");
  let descendant: { pid: number; parentPid: number } | undefined;
  const alive = (pid: number) => {
    if (process.platform !== "win32") {
      const result = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
      return result.status === 0 && !/^[ZX]/.test(result.stdout.trim());
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  try {
    const grandchild = join(directory, "grandchild.ts");
    await writeFile(
      grandchild,
      `
import { writeFileSync } from "node:fs";
process.on("SIGTERM", () => {});
writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ pid: process.pid, parentPid: process.ppid }));
setInterval(() => {}, 1000);
`,
    );
    const parent = join(directory, "parent.ts");
    await writeFile(
      parent,
      `
import { spawn } from "node:child_process";
process.on("SIGTERM", () => process.exit(0));
spawn(process.execPath, [${JSON.stringify(grandchild)}], { stdio: "inherit" });
setInterval(() => {}, 1000);
`,
    );
    const result = await runCiChecks(
      [
        { id: "parent", command: [process.execPath, parent] },
        {
          id: "failure",
          command: [
            process.execPath,
            "-e",
            `while (!(await Bun.file(${JSON.stringify(marker)}).exists())) await Bun.sleep(5); process.exit(2)`,
          ],
        },
      ],
      { priority: "P1", concurrency: 2 },
    );
    descendant = JSON.parse(await readFile(marker, "utf8"));
    for (let attempt = 0; attempt < 100 && alive(descendant!.pid); attempt++) await Bun.sleep(5);
    expect(result.results.map((check) => check.outcome)).toEqual(["cancelled", "failure"]);
    expect(alive(descendant!.pid)).toBe(false);
  } finally {
    if (!descendant) {
      try {
        descendant = JSON.parse(await readFile(marker, "utf8"));
      } catch {
        /* Startup may have failed. */
      }
    }
    if (descendant && alive(descendant.pid)) {
      if (process.platform === "win32") process.kill(descendant.pid, "SIGKILL");
      else process.kill(-descendant.parentPid, "SIGKILL");
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("the CLI queries P1 peers only when explicitly requested", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ci-peer-observation-"));
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
      requests++;
      return Response.json({
        jobs: [{ name: "database_tests", status: "completed", conclusion: "failure" }],
        total_count: 1,
      });
    },
  });
  try {
    for (const observe of [false, true]) {
      const marker = join(directory, String(observe));
      const child = Bun.spawn(
        [
          process.execPath,
          join(import.meta.dir, "run-ci-checks.ts"),
          "--priority",
          "P1",
          ...(observe ? ["--observe-peers"] : []),
          "--",
          process.execPath,
          "-e",
          `await Bun.write(${JSON.stringify(marker)}, "executed")`,
        ],
        {
          env: {
            ...process.env,
            GITHUB_API_URL: server.url.toString().replace(/\/$/, ""),
            GITHUB_REPOSITORY: "owner/repo",
            GITHUB_RUN_ID: "1",
            GITHUB_RUN_ATTEMPT: "1",
            GH_TOKEN: "fixture",
            CI_GATE_PLAN: "[]",
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [exitCode] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(exitCode).toBe(observe ? 1 : 0);
      expect(await Bun.file(marker).exists()).toBe(!observe);
      expect(requests).toBe(observe ? 1 : 0);
    }
  } finally {
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});

test("an interrupted local run starts no commands and reports them unfinished", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await runCiChecks([{ id: "pending", command: [process.execPath, "-e", "process.exit(0)"] }], {
    priority: "P0",
    signal: controller.signal,
  });
  expect(result.outcome).toBe("failure");
  expect(result.results[0]?.outcome).toBe("cancelled");
});

test("explicit cancellation stops an active child and does not launch the next check", async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    const result = await runCiChecks(
      [
        { id: "active", command: [process.execPath, "-e", "setInterval(() => {}, 1000)"] },
        { id: "pending", command: [process.execPath, "-e", "process.exit(0)"] },
      ],
      { priority: "P0", signal: controller.signal },
    );
    expect(result.results.map((entry) => entry.outcome)).toEqual(["cancelled", "cancelled"]);
  } finally {
    clearTimeout(timer);
  }
});

test("a local supervisor retains logs and reaps background children after a successful leader exits", async () => {
  if (process.platform === "win32") return;
  const directory = await mkdtemp(join(tmpdir(), "local-check-cleanup-"));
  const marker = join(directory, "child.pid");
  try {
    const childCode = `process.on('SIGTERM', () => {}); console.log('retained child output'); await Bun.write(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000);`;
    const leaderCode = `Bun.spawn([process.execPath, '-e', ${JSON.stringify(childCode)}], {stdout:'inherit',stderr:'inherit'}); while (!(await Bun.file(${JSON.stringify(marker)}).exists())) await Bun.sleep(5); process.exit(0);`;
    const result = await runCiChecks([{ id: "background", command: [process.execPath, "-e", leaderCode] }], {
      priority: "P0",
      cleanupOnExit: true,
      logDirectory: directory,
    });
    expect(result.outcome).toBe("success");
    expect(await readFile(join(directory, "0-background.log"), "utf8")).toContain("retained child output");
    const pid = Number(await readFile(marker, "utf8"));
    const state = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
    expect(state.status !== 0 || /^[ZX]/.test(state.stdout.trim())).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a supervisor cancels an inherited worker group including TERM-resistant descendants", async () => {
  if (process.platform === "win32") return;
  const directory = await mkdtemp(join(tmpdir(), "local-worker-cancel-"));
  const marker = join(directory, "descendant.pid");
  const controller = new AbortController();
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    const descendant = `process.on('SIGTERM', () => {}); await Bun.write(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000);`;
    const worker = `import { runCiChecks } from ${JSON.stringify(join(import.meta.dirname, "run-ci-checks.ts"))}; await runCiChecks([{id:'inner',command:[process.execPath,'-e',${JSON.stringify(descendant)}]}],{priority:'P0',inheritProcessGroup:true});`;
    timer = setInterval(async () => {
      if (await Bun.file(marker).exists()) controller.abort();
    }, 10);
    const result = await runCiChecks([{ id: "supervisor", command: [process.execPath, "-e", worker] }], {
      priority: "P0",
      signal: controller.signal,
    });
    expect(result.results[0]?.outcome).toBe("cancelled");
    const pid = Number(await readFile(marker, "utf8"));
    const state = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
    expect(state.status !== 0 || /^[ZX]/.test(state.stdout.trim())).toBe(true);
  } finally {
    clearInterval(timer);
    await rm(directory, { recursive: true, force: true });
  }
});

test("local cancellation captures detached grandchildren before their parent exits", async () => {
  if (process.platform === "win32") return;
  const directory = await mkdtemp(join(tmpdir(), "local-detached-cancel-"));
  const marker = join(directory, "detached.pid");
  const controller = new AbortController();
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    const descendant = `process.on('SIGTERM', () => {}); await Bun.write(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000);`;
    const leader = `import {spawn} from 'node:child_process'; spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{detached:true,stdio:'ignore'}); setInterval(() => {},1000);`;
    timer = setInterval(async () => {
      if (await Bun.file(marker).exists()) controller.abort();
    }, 10);
    const result = await runCiChecks([{ id: "detached", command: [process.execPath, "-e", leader] }], {
      priority: "P0",
      signal: controller.signal,
      cleanupOnExit: true,
    });
    expect(result.results[0]?.outcome).toBe("cancelled");
    const pid = Number(await readFile(marker, "utf8"));
    const state = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
    expect(state.status !== 0 || /^[ZX]/.test(state.stdout.trim())).toBe(true);
  } finally {
    clearInterval(timer);
    await rm(directory, { recursive: true, force: true });
  }
});

test("process inspection failure cannot prevent cancellation or become a pass", async () => {
  if (process.platform === "win32") return;
  const directory = await mkdtemp(join(tmpdir(), "local-inspection-failure-"));
  const originalPath = process.env.PATH;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    await writeFile(join(directory, "ps"), "#!/bin/sh\nexit 42\n", { mode: 0o755 });
    process.env.PATH = directory;
    const result = await runCiChecks(
      [{ id: "active", command: [process.execPath, "-e", "setInterval(() => {}, 1000)"] }],
      {
        priority: "P0",
        signal: controller.signal,
        cleanupOnExit: true,
      },
    );
    expect(result.outcome).toBe("failure");
    expect(result.results[0]?.outcome).toBe("cancelled");
    expect(result.cleanupFailures?.length).toBeGreaterThan(0);
  } finally {
    process.env.PATH = originalPath;
    clearTimeout(timer);
    await rm(directory, { recursive: true, force: true });
  }
});

test("a log write failure cancels owned work and cannot report success", async () => {
  const directory = await mkdtemp(join(tmpdir(), "local-log-failure-"));
  try {
    await mkdir(join(directory, "0-active.log"));
    const result = await runCiChecks(
      [{ id: "active", command: [process.execPath, "-e", "setInterval(() => {}, 1000)"] }],
      {
        priority: "P0",
        logDirectory: directory,
      },
    );
    expect(result.outcome).toBe("failure");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
