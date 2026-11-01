import { expect, test } from "bun:test";
import { runApiTestFiles } from "./api-test-scheduler";

for (const [platform, separator] of [
  ["POSIX", "/"],
  ["Windows", "\\"],
]) {
  test(`runs an exclusive file alone after shared workers finish with ${platform} paths`, async () => {
    const exclusive = ["src", "features", "startup.exclusive.p1.test.ts"].join(separator);
    const files = ["first.test.ts", exclusive, "last.test.ts"];
    const active = new Set<string>();
    const completed: string[] = [];
    const started: Array<{ file: string; active: string[]; completed: string[] }> = [];

    await runApiTestFiles(files, async (file) => {
      started.push({ file, active: [...active], completed: [...completed] });
      active.add(file);
      await new Promise((resolve) => setImmediate(resolve));
      active.delete(file);
      completed.push(file);
      return 0;
    });

    expect([...completed].sort()).toEqual([...files].sort());
    expect(started.find(({ file }) => file === exclusive)).toEqual({
      file: exclusive,
      active: [],
      completed: ["first.test.ts", "last.test.ts"],
    });
    expect(started.find(({ file }) => file === "last.test.ts")?.active).toContain("first.test.ts");
  });
}

for (const priority of ["P0", "P2", "P3"]) {
  test(`${priority} collects every file after independent failures`, async () => {
    const started: string[] = [];
    const results = await runApiTestFiles(
      ["first", "second", "last"],
      async (file) => {
        started.push(file);
        return file === "second" ? 0 : 1;
      },
      { priority },
    );
    expect(started.sort()).toEqual(["first", "last", "second"]);
    expect(results.map((result) => result.outcome)).toEqual(["failure", "success", "failure"]);
  });
}

test("P1 cancels active files and never starts remaining or isolated files", async () => {
  const started: string[] = [];
  let releaseStarted: () => void = () => {};
  const activeStarted = new Promise<void>((resolve) => {
    releaseStarted = resolve;
  });
  const results = await runApiTestFiles(
    ["active", "failure", "pending", "src/features/startup.exclusive.p1.test.ts"],
    async (file, signal) => {
      started.push(file);
      if (file === "active") {
        releaseStarted();
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        return 143;
      }
      await activeStarted;
      return 2;
    },
    { priority: "P1" },
  );
  expect(started).toEqual(["active", "failure"]);
  expect(results.map((result) => result.outcome)).toEqual(["cancelled", "failure", "cancelled", "cancelled"]);
});

test("P1 waits for an active child to exit after cancelling it", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "api-child-cancel-"));
  const children: ReturnType<typeof Bun.spawn>[] = [];
  try {
    const marker = join(directory, "active");
    const results = await runApiTestFiles(
      ["active", "failure", "pending"],
      async (file, signal) => {
        const code =
          file === "active"
            ? `await Bun.write(${JSON.stringify(marker)}, "started"); setInterval(() => {}, 1000); await new Promise(() => {});`
            : `while (!(await Bun.file(${JSON.stringify(marker)}).exists())) await Bun.sleep(1); process.exit(2);`;
        const child = Bun.spawn([process.execPath, "--no-orphans", "-e", code], { stdout: "ignore", stderr: "ignore" });
        children.push(child);
        const abort = () => child.kill();
        signal.addEventListener("abort", abort, { once: true });
        try {
          return await child.exited;
        } finally {
          signal.removeEventListener("abort", abort);
        }
      },
      { priority: "P1" },
    );
    expect(results.map((result) => result.outcome)).toEqual(["cancelled", "failure", "cancelled"]);
    expect(children).toHaveLength(2);
    expect(children.every((child) => child.exitCode !== null || child.signalCode !== null)).toBe(true);
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await child.exited;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("an external cancellation keeps its signal reason and starts no files", async () => {
  const controller = new AbortController();
  controller.abort("signal:SIGTERM");
  let started = false;
  const results = await runApiTestFiles(
    ["selected"],
    async () => {
      started = true;
      return 0;
    },
    {
      priority: "P2",
      signal: controller.signal,
    },
  );
  expect(started).toBe(false);
  expect(results[0]).toMatchObject({ outcome: "cancelled", durationMs: null, cancellationReason: "signal:SIGTERM" });
});

test("a file that never finishes is stopped as stalled while the other files still run", async () => {
  const reasons: unknown[] = [];
  const results = await runApiTestFiles(
    ["stuck", "quick"],
    async (file, signal) => {
      if (file === "quick") return 0;
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      reasons.push(signal.reason);
      return 137;
    },
    { priority: "P2", stallMs: 20 },
  );
  expect(reasons).toEqual(["stalled"]);
  expect(results.map((result) => [result.file, result.outcome, result.error])).toEqual([
    ["stuck", "failure", "stalled for 0.02 s"],
    ["quick", "success", undefined],
  ]);
});
