import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeBeforeFatalExit } from "./app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "./features/harnesses/test-harness-registry";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { createTestApp } from "./test-utils/create-test-app";
import { folderProjectInput } from "./test-utils/folder-project-input";

setDefaultTimeout(20_000);

const withTempRoot = async (run: (root: string) => Promise<void>) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-app-database-close-"));
  try {
    await run(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

// A second open of the same PGlite folder fails while this process still holds its lock.
const reopen = async (root: string) => {
  const reopened = await createTestApp({ databasePath: join(root, "pstdio.db"), storageRoot: join(root, "storage") });
  await reopened.close();
};

describe("app database close", () => {
  test.each(["start", "resume"] as const)("drains direct %s reads before closing the database", async (kind) => {
    await withTempRoot(async (root) => {
      const registry = createTestHarnessRegistry([createTestHarnessRecord("fake")]);
      const handle = await createTestApp({
        databasePath: join(root, "pstdio.db"),
        storageRoot: join(root, "storage"),
        harnessRegistry: registry,
      });
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const disposed = Promise.withResolvers<void>();
      try {
        const get = handle.deps.sessionService.get;
        let held = false;
        spyOn(handle.deps.sessionService, "get").mockImplementation(async (id) => {
          if (!held && handle.deps.sessionService.store.get(id)) {
            held = true;
            entered.resolve();
            await release.promise;
          }
          return get(id);
        });
        const dispose = registry.dispose;
        spyOn(registry, "dispose").mockImplementation(async () => {
          try {
            await dispose();
          } finally {
            disposed.resolve();
          }
        });
        let databaseClosing = false;
        const flush = handle.deps.extensionResourceSequencesService.flush;
        spyOn(handle.deps.extensionResourceSequencesService, "flush").mockImplementation(async () => {
          databaseClosing = true;
          await flush();
        });
        const projectResponse = await handle.app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "Startup read shutdown" })),
        });
        expect(projectResponse.status).toBe(201);
        const project = await projectResponse.json();
        if (kind === "start") {
          const response = await handle.app.request("/v1/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              project_id: project.id,
              title: "Shutdown while starting",
              agent: testHarnessId("fake"),
              prompt: "Keep this request durable",
            }),
          });
          expect(response.status).toBe(201);
        } else {
          const session = await handle.deps.sessionService.create({
            project_id: project.id,
            title: "Resume during shutdown",
            agent: testHarnessId("fake"),
          });
          await handle.deps.sessionService.update(session.id, { agent_session_id: "previous-agent" });
          await handle.deps.sessionService.transitionStatus(session.id, "completed", { drainCapacity: false });
          const saved = await get(session.id);
          if (!saved) throw new Error("Missing saved session");
          await createSessionScheduler(handle.deps).startOrQueueExisting({ session: saved, prompt: "Continue" });
        }
        await entered.promise;
        const closing = handle.close();
        let closedBeforeReadSettled: boolean;
        try {
          await disposed.promise;
          await Bun.sleep(0);
          closedBeforeReadSettled = databaseClosing;
        } finally {
          release.resolve();
          await closing;
        }
        expect(closedBeforeReadSettled).toBe(false);
      } finally {
        release.resolve();
        await handle.close();
      }
    });
  });

  test("drains resource number maintenance before closing the database when another cleanup fails", async () => {
    await withTempRoot(async (root) => {
      const handle = await createTestApp({ databasePath: join(root, "pstdio.db"), storageRoot: join(root, "storage") });
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const flush = handle.deps.extensionResourceSequencesService.flush;
      spyOn(handle.deps.extensionResourceSequencesService, "flush").mockImplementation(async () => {
        entered.resolve();
        await release.promise;
        await flush();
      });
      spyOn(handle.deps.automationService, "close").mockRejectedValue(new Error("automation close failed"));
      const closing = handle.close().catch((error: unknown) => error);
      try {
        expect(await Promise.race([entered.promise.then(() => true), closing.then(() => false)])).toBe(true);
      } finally {
        release.resolve();
        await closing;
      }
      await reopen(root);
    });
  });

  test("closes the database when startup fails after the database opened", async () => {
    await withTempRoot(async (root) => {
      const fileInTheWay = join(root, "not-a-folder");
      writeFileSync(fileInTheWay, "");

      await expect(
        createTestApp({ databasePath: join(root, "pstdio.db"), storageRoot: join(fileInTheWay, "storage") }),
      ).rejects.toThrow();

      await reopen(root);
    });
  });

  test("closes the database when another part fails to close", async () => {
    await withTempRoot(async (root) => {
      const handle = await createTestApp({ databasePath: join(root, "pstdio.db"), storageRoot: join(root, "storage") });
      spyOn(handle.deps.automationService, "close").mockRejectedValue(new Error("automation close failed"));

      await expect(handle.close()).rejects.toThrow("automation close failed");

      await reopen(root);
    });
  });

  test("drains session hook reads before closing the database even when cleanup fails", async () => {
    await withTempRoot(async (root) => {
      const handle = await createTestApp({ databasePath: join(root, "pstdio.db"), storageRoot: join(root, "storage") });
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const getWorkspace = handle.deps.workspaceSessionService.getWorkspaceBySessionId;
      spyOn(handle.deps.workspaceSessionService, "getWorkspaceBySessionId").mockImplementation(async (id) => {
        entered.resolve();
        await release.promise;
        return getWorkspace(id);
      });
      spyOn(handle.deps.automationService, "close").mockRejectedValue(new Error("automation close failed"));
      handle.deps.sessionService.emitStartedHook({ id: "pending-hook", project_id: "project", status: "in_progress" });
      await entered.promise;
      let settled = false;
      const closing = handle
        .close()
        .then(
          () => undefined,
          (error: unknown) => error,
        )
        .finally(() => {
          settled = true;
        });
      await Bun.sleep(0);
      expect(settled).toBe(false);
      release.resolve();
      expect(await closing).toEqual(new Error("automation close failed"));
      await reopen(root);
    });
  });
});

describe("closeBeforeFatalExit", () => {
  test("waits for close to finish", async () => {
    let closed = false;

    await closeBeforeFatalExit(async () => {
      await Bun.sleep(20);
      closed = true;
    });

    expect(closed).toBe(true);
  });

  test("stops waiting when close does not finish before the deadline", async () => {
    const result = await Promise.race([
      closeBeforeFatalExit(() => new Promise<void>(() => {}), 10).then(() => "stopped waiting" as const),
      Bun.sleep(1_000).then(() => "still waiting" as const),
    ]);

    expect(result).toBe("stopped waiting");
  });

  test("does not reject when close fails", async () => {
    await expect(closeBeforeFatalExit(() => Promise.reject(new Error("close failed")))).resolves.toBeUndefined();
  });
});
