import { afterEach, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createDiagnosticCommands } from "./commands";
import { captureFiles } from "./files";
import { diagnosticRunning } from "./types";

type Run = NonNullable<Awaited<ReturnType<CommandContext["automation"]["get"]>>>;
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
const setup = async () => {
  const directory = await mkdtemp(join(tmpdir(), "performance-commands-"));
  directories.push(directory);
  const commands = createDiagnosticCommands(directory);
  const controller = new AbortController();
  let run: Run | undefined;
  let input: { id: string } | undefined;
  let rejectAdmission = false;
  const extraRuns = new Map<string, Run>();
  let beforeRead: ((id: string) => Promise<void>) | undefined;
  const context = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      extensionId: "pstdio.pstdio-performance",
      commandId: "diagnostics.test",
      projectId: "project-1",
      signal: controller.signal,
      automation: {
        enqueue: async (request) => {
          if (rejectAdmission) throw new Error("Runtime admission failed");
          input = { id: String(request.input.params?.id) };
          run = { id: "automation-1", status: "queued", error: null } as Run;
          return run;
        },
        get: async (id) => {
          await beforeRead?.(id);
          return id === "automation-1" ? run : extraRuns.get(id);
        },
        cancel: async () => {
          controller.abort();
          run = { ...run, status: "cancelled", finishedAt: new Date().toISOString() } as Run;
          return run;
        },
      },
    },
  });
  return {
    commands,
    context,
    files: captureFiles(directory, context.projectId),
    onRead: (handler: (id: string) => Promise<void>) => {
      beforeRead = handler;
    },
    addRun: (id: string, status: Run["status"], finishedAt: string | null = null) =>
      extraRuns.set(id, { id, status, finishedAt } as Run),
    rejectAdmission: () => {
      rejectAdmission = true;
    },
    forgetRun: () => {
      run = undefined;
    },
    collect: async () => {
      if (!run || !input) throw new Error("No capture queued");
      run.status = "running";
      try {
        await commands["diagnostics.capture"].run(context, input);
        run.status = "succeeded";
      } catch (error) {
        if (!controller.signal.aborted) run.status = "failed";
        throw error;
      }
    },
  };
};

test("start, read, list and export share one durable capture and preserve evidence after job expiry", async () => {
  const app = await setup();
  const start = await app.commands["diagnostics.start"].run(app.context, { kind: "cpu", seconds: 1 });
  expect(start.status).toBe("queued");
  await app.collect();
  const read = await app.commands["diagnostics.read"].run(app.context, { id: start.id });
  expect(read.status).toBe("succeeded");
  expect(read.pid).toBe(process.pid);
  expect(read.summary?.unit).toBe("samples");
  expect((await app.commands["diagnostics.list"].run(app.context, {}))[0]?.id).toBe(start.id);
  const exported = await app.commands["diagnostics.export"].run(app.context, { id: start.id });
  expect(exported.capture.id).toBe(start.id);
  expect(exported.data).toHaveProperty("profile.nodes");
  app.forgetRun();
  expect((await app.commands["diagnostics.read"].run(app.context, { id: start.id })).status).toBe("succeeded");
});

test("interrupted, expired and orphaned admissions share bounded history without evicting live jobs", async () => {
  const app = await setup();
  const finishedAt = new Date().toISOString();
  for (let index = 0; index < 15; index++) {
    const automationId = `interrupted-${index}`;
    if (index % 3 === 0) app.addRun(automationId, "failed", finishedAt);
    await app.files.create({
      id: randomUUID(),
      projectId: app.context.projectId,
      kind: "cpu",
      seconds: 1,
      createdAt: new Date(index * 1000).toISOString(),
      automationId: index % 3 === 2 ? undefined : automationId,
    });
  }
  for (const status of ["queued", "running"] as const) {
    app.addRun(status, status);
    await app.files.create({
      id: randomUUID(),
      projectId: app.context.projectId,
      kind: "cpu",
      seconds: 1,
      createdAt: new Date(0).toISOString(),
      automationId: status,
    });
  }
  const history = await app.commands["diagnostics.list"].run(app.context, {});
  expect(history.filter((capture) => !diagnosticRunning(capture))).toHaveLength(10);
  expect(history.filter(diagnosticRunning)).toHaveLength(2);
  expect(await app.files.list()).toHaveLength(12);
  expect(
    history.filter((capture) => capture.status === "failed").every((capture) => capture.finishedAt === finishedAt),
  ).toBe(true);
  expect(history.filter((capture) => capture.status === "unavailable").every((capture) => !capture.finishedAt)).toBe(
    true,
  );
});

test("an orphaned admission reports unavailable and does not block the next capture", async () => {
  const app = await setup();
  const id = randomUUID();
  await app.files.create({
    id,
    projectId: app.context.projectId,
    kind: "cpu",
    seconds: 1,
    createdAt: new Date().toISOString(),
  });
  const orphan = await app.commands["diagnostics.read"].run(app.context, { id });
  expect(orphan.status).toBe("unavailable");
  expect(diagnosticRunning(orphan)).toBe(false);
  expect((await app.commands["diagnostics.start"].run(app.context, { seconds: 1 })).status).toBe("queued");
});

test("concurrent history reads tolerate retention removing an older capture during reconciliation", async () => {
  const app = await setup();
  for (let index = 0; index < 15; index++) {
    const automationId = `run-${index}`;
    app.addRun(automationId, "failed", new Date().toISOString());
    await app.files.create({
      id: randomUUID(),
      projectId: app.context.projectId,
      kind: "cpu",
      seconds: 1,
      createdAt: new Date(index * 1000).toISOString(),
      automationId,
    });
  }
  let resume!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const paused = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let pauseOnce = true;
  app.onRead(async (id) => {
    if (id !== "run-0" || !pauseOnce) return;
    pauseOnce = false;
    entered();
    await gate;
  });
  const slow = app.commands["diagnostics.list"].run(app.context, {});
  await paused;
  const fast = await app.commands["diagnostics.list"].run(app.context, {});
  resume();
  expect(await slow).toEqual(fast);
  expect(fast).toHaveLength(10);
  app.onRead(async () => {
    throw new Error("Runtime disconnected");
  });
  await expect(app.commands["diagnostics.list"].run(app.context, {})).rejects.toThrow("Runtime disconnected");
});

test("cancel stops the profiler without publishing incomplete evidence", async () => {
  const app = await setup();
  const start = await app.commands["diagnostics.start"].run(app.context, { kind: "coverage", seconds: 60 });
  const capture = app.collect().then(
    () => false,
    () => true,
  );
  await app.commands["diagnostics.cancel"].run(app.context, { id: start.id });
  expect(await capture).toBe(true);
  const read = await app.commands["diagnostics.read"].run(app.context, { id: start.id });
  expect(read.status).toBe("cancelled");
  expect(read.hasResult).toBe(false);
});

test("invalid durations create no capture; admission failure remains inspectable", async () => {
  const app = await setup();
  for (const seconds of [0, 61, 1.5]) {
    await expect(app.commands["diagnostics.start"].run(app.context, { seconds })).rejects.toThrow("1 to 60");
  }
  expect(await app.commands["diagnostics.list"].run(app.context, {})).toEqual([]);
  app.rejectAdmission();
  await expect(app.commands["diagnostics.start"].run(app.context, { seconds: 1 })).rejects.toThrow("admission failed");
  const [failed] = await app.commands["diagnostics.list"].run(app.context, {});
  expect(failed?.status).toBe("failed");
  expect(failed?.error).toContain("admission failed");
});
