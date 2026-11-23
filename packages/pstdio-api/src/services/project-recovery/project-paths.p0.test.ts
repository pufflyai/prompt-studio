import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectRejection } from "../../test-utils/expect-rejection";
import { acquireRecoveryJournalLease, openRecoveryJournal, recoveryJournalKey } from "./journal";
import { projectRecoveryRoot, removeProjectFolderRecovery } from "./project-paths";

test("removing project recovery retains a foreign process's journal and lease until it exits", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-recovery-removal-"));
  const owned = projectRecoveryRoot(root, "project");
  const source = ["project", "account", "workspace"];
  await openRecoveryJournal({ root: owned, source }).update({ candidate: null });
  const key = recoveryJournalKey(source);
  const path = join(owned, "sources", `${key}.json`);
  const leasePath = join(owned, "sources", `${key}.lock.sqlite`);
  const child = Bun.spawn(
    [process.execPath, join(import.meta.dir, "journal-owner.fixture.ts"), leasePath, "--lease-path"],
    {
      stdout: "pipe",
      stderr: "inherit",
    },
  );
  const ready = child.stdout.getReader();
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const output = await Promise.race([
      ready.read(),
      child.exited.then(() => {
        throw new Error("Source owner exited before readiness");
      }),
      new Promise<never>((_, reject) => {
        watchdog = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("Source owner did not become ready within 2000 ms"));
        }, 2000);
      }),
    ]);
    clearTimeout(watchdog);
    expect(new TextDecoder().decode(output.value).trim()).toBe("owned");
    const bytes = await readFile(path, "utf8");
    const inode = (await stat(leasePath)).ino;
    await expectRejection(removeProjectFolderRecovery(root, "project")).toThrow("Another Prompt Studio process");
    expect(await readFile(path, "utf8")).toBe(bytes);
    expect((await stat(leasePath)).ino).toBe(inode);
    child.kill("SIGKILL");
    await child.exited;
    await removeProjectFolderRecovery(root, "project");
    expect(await stat(owned).catch((error) => error.code)).toBe("ENOENT");
  } finally {
    clearTimeout(watchdog);
    child.kill("SIGKILL");
    await child.exited;
    ready.releaseLock();
    await rm(root, { recursive: true, force: true });
  }
});

test("recovery removal refuses a new source owner admitted after its lease scan", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-recovery-new-owner-"));
  const owned = projectRecoveryRoot(root, "project");
  await openRecoveryJournal({ root: owned, source: ["existing"] }).update({ candidate: null });
  const remove = fs.rm;
  let probed = false;
  const deleting = spyOn(fs, "rm").mockImplementation(async (path, options) => {
    if (path === owned && options?.recursive) {
      probed = true;
      const child = Bun.spawn([process.execPath, join(import.meta.dir, "journal-owner.fixture.ts"), owned, "--probe"], {
        stdout: "pipe",
        stderr: "inherit",
      });
      const output = await new Response(child.stdout).text();
      expect(await child.exited).toBe(0);
      expect(output.trim()).toBe("busy");
    }
    await remove(path, options);
  });
  try {
    await removeProjectFolderRecovery(root, "project");
    expect(probed).toBe(true);
  } finally {
    deleting.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});

test("independent source owners can share a project while removal waits for both", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-recovery-shared-owner-"));
  const owned = projectRecoveryRoot(root, "project");
  const first = await openRecoveryJournal({ root: owned, source: ["first"] }).acquire();
  const second = await openRecoveryJournal({ root: owned, source: ["second"] }).acquire();
  try {
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    await expectRejection(removeProjectFolderRecovery(root, "project")).toThrow("Another Prompt Studio process");
    await first!();
    await expectRejection(removeProjectFolderRecovery(root, "project")).toThrow("Another Prompt Studio process");
    await second!();
    await removeProjectFolderRecovery(root, "project");
    await expectRejection(stat(owned)).toMatchObject({ code: "ENOENT" });
  } finally {
    await first?.();
    await second?.();
    await rm(root, { recursive: true, force: true });
  }
});

test("recovery removal closes its own source leases before deleting their folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-recovery-own-leases-"));
  const owned = projectRecoveryRoot(root, "project");
  const source = ["project", "account", "workspace"];
  const release = await openRecoveryJournal({ root: owned, source }).acquire();
  expect(release).not.toBeNull();
  await release!();
  const leasePath = join(owned, "sources", `${recoveryJournalKey(source)}.lock.sqlite`);
  expect((await stat(leasePath)).isFile()).toBe(true);
  const remove = fs.rm;
  let reacquired: boolean | undefined;
  // Windows cannot delete a file this process still holds open, so the scan's leases must be closed first.
  const deleting = spyOn(fs, "rm").mockImplementation(async (path, options) => {
    if (path === owned && options?.recursive) {
      const release = acquireRecoveryJournalLease(leasePath, false);
      reacquired = release !== null;
      release?.();
    }
    await remove(path, options);
  });
  try {
    await removeProjectFolderRecovery(root, "project");
    expect(reacquired).toBe(true);
    expect(await stat(owned).catch((error) => error.code)).toBe("ENOENT");
  } finally {
    deleting.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});
