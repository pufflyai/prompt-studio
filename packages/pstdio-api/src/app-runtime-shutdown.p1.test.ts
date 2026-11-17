import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestHarnessRecord, createTestHarnessRegistry } from "./features/harnesses/test-harness-registry";
import { createTestApp } from "./test-utils/create-test-app";

test("a blocked shutdown records its entered phase when ordinary request logs are disabled", async () => {
  const root = await mkdtemp(join(tmpdir(), "runtime-shutdown-phase-"));
  const previous = { path: process.env.PSTDIO_LOG_PATH, level: process.env.PSTDIO_LOG_LEVEL };
  const path = join(root, "logs.jsonl");
  process.env.PSTDIO_LOG_PATH = path;
  process.env.PSTDIO_LOG_LEVEL = "error";
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const harness = createTestHarnessRecord("worker", {
    provider: {
      dispose: async () => {
        entered.resolve();
        await release.promise;
      },
    },
  });
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;
  let closing: Promise<void> | undefined;
  try {
    app = await createTestApp({ harnessRegistry: createTestHarnessRegistry([harness]) });
    await (await app.deps.harnessRegistry.get(harness.id))!.capabilities({ projectId: "p1" });
    closing = app.close();
    await entered.promise;
    const entries = (await readFile(path, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(entries).toContainEqual(
      expect.objectContaining({
        event: "runtime.shutdown.phase",
        phase: "harnesses",
        state: "started",
      }),
    );
  } finally {
    release.resolve();
    await (closing ?? app?.close());
    if (previous.path === undefined) delete process.env.PSTDIO_LOG_PATH;
    else process.env.PSTDIO_LOG_PATH = previous.path;
    if (previous.level === undefined) delete process.env.PSTDIO_LOG_LEVEL;
    else process.env.PSTDIO_LOG_LEVEL = previous.level;
    await rm(root, { recursive: true, force: true });
  }
});
