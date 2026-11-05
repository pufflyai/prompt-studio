import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstallations } from "./extension-installations";

const selection = (name: string, projectId = "project-1") => ({ installName: name, displayName: name, projectId });
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), "extension-installations-"));
  try {
    await run(join(root, "jobs.json"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe("extension installations", () => {
  test("waits for start before running recovered or new selections", async () => {
    let runs = 0;
    const jobs = createExtensionInstallations({
      installCatalog: async () => {
        runs++;
      },
    });
    const job = jobs.enqueue(selection("notes"));
    await Bun.sleep(0);
    expect(runs).toBe(0);
    jobs.start();
    await jobs.wait(job.id);
    expect(runs).toBe(1);
  });

  test("shares pending work and retries a failure when it is selected again", async () => {
    let attempts = 0;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const jobs = createExtensionInstallations({
      installCatalog: async () => {
        attempts++;
        entered.resolve();
        await release.promise;
        if (attempts === 1) throw new Error("Download failed");
      },
    });
    jobs.start();
    const job = jobs.enqueue(selection("codex"));
    expect(jobs.enqueue(selection("codex")).id).toBe(job.id);
    await entered.promise;
    expect(jobs.enqueue(selection("codex")).id).toBe(job.id);
    release.resolve();
    expect(await jobs.wait(job.id).catch((error: unknown) => error)).toMatchObject({ message: "Download failed" });
    expect(jobs.list()).toMatchObject([{ id: job.id, status: "failed", error: "Download failed" }]);

    const retry = jobs.enqueue(selection("codex"));
    await jobs.wait(retry.id);
    expect(attempts).toBe(2);
    expect(jobs.list()).toMatchObject([{ id: retry.id, status: "completed" }]);
  });

  test("keeps one entry per project selection, so completed work does not accumulate", async () => {
    const jobs = createExtensionInstallations({ installCatalog: async () => {} });
    jobs.start();
    for (let round = 0; round < 3; round++) {
      const selected = [jobs.enqueue(selection("notes")), jobs.enqueue(selection("notes", "project-2"))];
      await Promise.all(selected.map((job) => jobs.wait(job.id)));
    }
    expect(jobs.list().map(({ projectId, status }) => [projectId, status])).toEqual([
      ["project-1", "completed"],
      ["project-2", "completed"],
    ]);
  });

  test("installs one catalog extension at a time across projects, and others alongside it", async () => {
    const active: string[] = [];
    let overlap = false;
    const release = Promise.withResolvers<void>();
    const jobs = createExtensionInstallations({
      installCatalog: async (name, _signal, projectId) => {
        if (active.includes(name)) overlap = true;
        active.push(name);
        if (projectId === "project-1") await release.promise;
        active.splice(active.indexOf(name), 1);
      },
    });
    jobs.start();
    const first = jobs.enqueue(selection("notes"));
    const second = jobs.enqueue(selection("notes", "project-2"));
    const other = jobs.enqueue(selection("planner", "project-2"));
    await jobs.wait(other.id);
    expect(jobs.list().find(({ id }) => id === second.id)?.status).toBe("queued");
    release.resolve();
    await Promise.all([jobs.wait(first.id), jobs.wait(second.id)]);
    expect(overlap).toBe(false);
  });

  test("shutdown leaves running work queued; restart resumes it and persists only unfinished work", async () => {
    await withRoot(async (path) => {
      const started = Promise.withResolvers<void>();
      const first = createExtensionInstallations({
        path,
        installCatalog: async (_name, signal) => {
          started.resolve();
          await new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
          );
        },
      });
      first.start();
      const job = first.enqueue(selection("notes"));
      await started.promise;
      await first.dispose();
      expect(first.list()[0]?.status).toBe("queued");
      expect(() => first.enqueue(selection("planner"))).toThrow();

      const projects: string[] = [];
      const second = createExtensionInstallations({
        path,
        installCatalog: async (_name, _signal, projectId) => {
          projects.push(projectId);
        },
      });
      second.start();
      await second.wait(job.id);
      await second.flush();
      expect(projects).toEqual(["project-1"]);
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual([]);

      let replayed = 0;
      const third = createExtensionInstallations({
        path,
        installCatalog: async () => {
          replayed++;
        },
      });
      third.start();
      await Bun.sleep(0);
      expect(replayed).toBe(0);
      expect(third.list()).toEqual([]);
    });
  });

  test("a failure survives restart without running again until it is selected again", async () => {
    await withRoot(async (path) => {
      const first = createExtensionInstallations({
        path,
        installCatalog: async () => {
          throw new Error("Download failed");
        },
      });
      first.start();
      const job = first.enqueue(selection("notes"));
      await first.wait(job.id).catch(() => {});
      await first.flush();

      let runs = 0;
      const second = createExtensionInstallations({
        path,
        installCatalog: async () => {
          runs++;
        },
      });
      second.start();
      await Bun.sleep(0);
      expect(runs).toBe(0);
      expect(second.list()).toMatchObject([{ id: job.id, status: "failed" }]);
      await second.wait(second.enqueue(selection("notes")).id);
      expect(runs).toBe(1);
    });
  });

  test("runs project completion after the installation and reports its failure", async () => {
    const completed: string[] = [];
    const jobs = createExtensionInstallations({
      installCatalog: async () => {},
      afterCatalogInstall: async (name, projectId) => {
        completed.push(`${projectId}:${name}`);
        if (name === "broken") throw new Error("Workspace setup failed");
      },
    });
    jobs.start();
    await jobs.wait(jobs.enqueue(selection("notes")).id);
    const broken = jobs.enqueue(selection("broken"));
    expect(await jobs.wait(broken.id).catch((error: unknown) => error)).toMatchObject({
      message: "Workspace setup failed",
    });
    expect(completed).toEqual(["project-1:notes", "project-1:broken"]);
  });
});
