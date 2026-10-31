import { describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstallations } from "./extension-installations";

const extension = (name: string) => ({ installName: name, displayName: name });

describe("extension installation jobs", () => {
  test("schedules independent physical targets for the same extension", async () => {
    const jobs = createExtensionInstallations();
    const gate = Promise.withResolvers<void>();
    const source = jobs.run(extension("same"), () => gate.promise);
    const cache = jobs.run(extension("same"), async () => "cached", "/cache/same/cli@1.0.0");
    await Bun.sleep(0);
    try {
      expect(jobs.list()[1]?.status).toBe("completed");
    } finally {
      gate.resolve();
      await Promise.all([source, cache]);
    }
  });
  test("stops active operations before shutdown and leaves catalog work queued for restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "extension-jobs-stop-"));
    const path = join(root, "jobs.json");
    const started = Promise.withResolvers<void>();
    try {
      const jobs = createExtensionInstallations({
        path,
        installCatalog: async (_name, signal) => {
          started.resolve();
          await new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
          );
        },
      });
      const job = jobs.enqueueCatalog(extension("notes"));
      await started.promise;
      await jobs.dispose();
      expect(jobs.list()[0]?.status).toBe("queued");
      const restarted = createExtensionInstallations({ path, installCatalog: async () => {} });
      await restarted.wait(job.id);
      expect(restarted.list()[0]?.status).toBe("completed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  test("resumes unfinished catalog jobs after restart and does not replay completed installations", async () => {
    const root = await mkdtemp(join(tmpdir(), "extension-jobs-"));
    const path = join(root, "jobs.json");
    const gate = Promise.withResolvers<void>();
    let resumed = 0;
    const projects: (string | undefined)[] = [];
    try {
      const first = createExtensionInstallations({ path, installCatalog: () => gate.promise });
      const job = first.enqueueCatalog({ ...extension("notes"), projectId: "project-1" });
      await Bun.sleep(0);
      await first.flush();
      const second = createExtensionInstallations({
        path,
        installCatalog: async (_name, _signal, projectId) => {
          resumed++;
          projects.push(projectId);
        },
      });
      await second.wait(job.id);
      expect(second.list()[0]?.status).toBe("completed");
      const third = createExtensionInstallations({
        path,
        installCatalog: async () => {
          resumed++;
        },
      });
      third.enqueueCatalog({ ...extension("notes"), projectId: "project-1" });
      await Bun.sleep(0);
      expect(resumed).toBe(1);
      expect(projects).toEqual(["project-1"]);
      expect(third.list()).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  test("tracks an atomic extension set as separate items and retries the failed set together", async () => {
    const jobs = createExtensionInstallations();
    let attempts = 0;
    await expect(
      jobs.runGroup([extension("one"), extension("two")], async () => {
        if (++attempts === 1) throw new Error("Activation failed");
        return "active";
      }),
    ).rejects.toThrow("Activation failed");
    expect(jobs.list().map((job) => job.status)).toEqual(["failed", "failed"]);
    const first = jobs.list()[0]!;
    jobs.retry(first.id);
    await jobs.wait(first.id);
    expect(attempts).toBe(2);
    expect(jobs.list().map((job) => job.status)).toEqual(["completed", "completed"]);
  });
  test("records a synchronous failure and continues with other installations", async () => {
    const jobs = createExtensionInstallations();
    const failed = jobs.enqueue(extension("failed"), () => {
      throw new Error("Source unavailable");
    });
    const next = jobs.enqueue(extension("next"), async () => "done");
    await Bun.sleep(0);
    expect(jobs.list().find((job) => job.id === failed.id)?.status).toBe("failed");
    await jobs.wait(next.id);
    await expect(jobs.wait(failed.id)).rejects.toThrow("Source unavailable");
  });
  test("returns queued work immediately and keeps the host responsive while it runs", async () => {
    const jobs = createExtensionInstallations();
    const gate = Promise.withResolvers<void>();
    const first = jobs.enqueue(extension("first"), () => gate.promise);
    const second = jobs.enqueue(extension("second"), async () => "ready");
    expect(first.status).toBe("queued");
    await Bun.sleep(0);
    expect(jobs.list().find((job) => job.id === first.id)?.status).toBe("running");
    expect(jobs.list().find((job) => job.id === second.id)?.status).toBe("completed");
    gate.resolve();
    await jobs.wait(first.id);
    expect(jobs.list().find((job) => job.id === first.id)?.status).toBe("completed");
  });

  test("retries only the failed operation and preserves completed work", async () => {
    const jobs = createExtensionInstallations();
    let attempts = 0;
    const done = jobs.enqueue(extension("done"), async () => "done");
    const failed = jobs.enqueue(extension("failed"), async () => {
      if (++attempts === 1) throw new Error("Download failed");
      return "recovered";
    });
    await Promise.allSettled([jobs.wait(done.id), jobs.wait(failed.id)]);
    expect(jobs.list().find((job) => job.id === failed.id)).toMatchObject({
      status: "failed",
      error: "Download failed",
    });
    const completed = jobs.list().find((job) => job.id === done.id);
    jobs.retry(failed.id);
    await jobs.wait(failed.id);
    expect(attempts).toBe(2);
    expect(jobs.list().find((job) => job.id === done.id)).toEqual(completed);
    expect(jobs.list().find((job) => job.id === failed.id)?.error).toBeUndefined();
    jobs.retry(done.id);
    expect(jobs.list().find((job) => job.id === done.id)).toEqual(completed);
  });

  test("serializes replacements of the same extension while other extensions proceed", async () => {
    const jobs = createExtensionInstallations();
    const gate = Promise.withResolvers<void>();
    const order: string[] = [];
    const first = jobs.enqueue(extension("same"), async () => {
      await gate.promise;
      order.push("first");
    });
    const next = jobs.enqueue(extension("same"), async () => {
      order.push("next");
    });
    const other = jobs.enqueue(extension("other"), async () => {
      order.push("other");
    });
    await jobs.wait(other.id);
    expect(order).toEqual(["other"]);
    expect(jobs.list().find((job) => job.id === next.id)?.status).toBe("queued");
    gate.resolve();
    await Promise.all([jobs.wait(first.id), jobs.wait(next.id)]);
    expect(order).toEqual(["other", "first", "next"]);
  });
});

test("a failed attempt cannot settle or release a running retry", async () => {
  const failedWrite = Promise.withResolvers<void>();
  const releaseWrite = Promise.withResolvers<void>();
  const retryStarted = Promise.withResolvers<void>();
  const releaseRetry = Promise.withResolvers<void>();
  let attempts = 0;
  const jobs = createExtensionInstallations({
    installCatalog: async () => {
      if (++attempts === 1) throw new Error("Download failed");
      retryStarted.resolve();
      await releaseRetry.promise;
    },
  });
  // Hold the storage boundary after failure becomes visible, as a slow disk can do.
  const storage = (jobs as unknown as { storage: { save: () => Promise<void> } }).storage;
  const save = spyOn(storage, "save").mockImplementation(async () => {
    if (jobs.list()[0]?.status === "failed") {
      failedWrite.resolve();
      await releaseWrite.promise;
    }
  });
  const job = jobs.enqueueCatalog(extension("retry"));
  let originalError: unknown;
  const original = jobs.wait(job.id).catch((error) => {
    originalError = error;
  });
  try {
    await failedWrite.promise;
    jobs.retry(job.id);
    const retried = jobs.wait(job.id);
    let retrySettled = false;
    void retried.then(
      () => {
        retrySettled = true;
      },
      () => {
        retrySettled = true;
      },
    );
    await Bun.sleep(0);
    releaseWrite.resolve();
    await Bun.sleep(0);
    expect(originalError).toBeInstanceOf(Error);
    expect(retrySettled).toBe(false);
    await retryStarted.promise;
    let disposed = false;
    const stopping = jobs.dispose().then(() => {
      disposed = true;
    });
    await Bun.sleep(0);
    expect(disposed).toBe(false);
    releaseRetry.resolve();
    await Promise.all([original, retried, stopping]);
  } finally {
    releaseWrite.resolve();
    releaseRetry.resolve();
    save.mockRestore();
    await jobs.dispose();
  }
});

test("empty installation groups complete post-processing and report its failures", async () => {
  const jobs = createExtensionInstallations();
  const results: number[] = [];
  expect(
    await jobs.runGroup(
      [],
      async () => 42,
      [],
      async (result) => {
        results.push(result);
      },
    ),
  ).toBe(42);
  expect(results).toEqual([42]);
  await expect(
    jobs.runGroup(
      [],
      async () => 42,
      [],
      async () => {
        throw new Error("Setup failed");
      },
    ),
  ).rejects.toThrow("Setup failed");
  await jobs.dispose();
});

test("shutdown waits for empty-group setup and refuses later work", async () => {
  const jobs = createExtensionInstallations();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const setup = jobs.runGroup(
    [],
    async () => 42,
    [],
    async () => {
      started.resolve();
      await release.promise;
    },
  );
  await started.promise;
  let disposed = false;
  const stopping = jobs.dispose().then(() => {
    disposed = true;
  });
  try {
    await Bun.sleep(0);
    expect(disposed).toBe(false);
    await expect(jobs.runGroup([], async () => 0)).rejects.toThrow("shutting down");
    expect(jobs.list()).toEqual([]);
  } finally {
    release.resolve();
    await Promise.all([setup, stopping]);
  }
});

test("an initially empty request can discover visible work and retry it", async () => {
  const jobs = createExtensionInstallations();
  const discovered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let attempts = 0;
  const request = jobs.runGroup([], async (_signal, include) => {
    include([extension("discovered")]);
    discovered.resolve();
    await release.promise;
    if (++attempts === 1) throw new Error("Download interrupted");
  });
  void request.catch(() => {});
  try {
    await discovered.promise;
    expect(jobs.list()).toMatchObject([{ installName: "discovered", status: "running" }]);
    release.resolve();
    await expect(request).rejects.toThrow("Download interrupted");
    const job = jobs.list()[0]!;
    jobs.retry(job.id);
    await jobs.wait(job.id);
    expect(jobs.list()).toMatchObject([{ id: job.id, installName: "discovered", status: "completed" }]);
  } finally {
    release.resolve();
    await request.catch(() => {});
    await jobs.dispose();
  }
});
