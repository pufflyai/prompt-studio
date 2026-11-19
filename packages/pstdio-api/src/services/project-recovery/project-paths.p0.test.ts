import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openRecoveryJournal, recoveryJournalKey } from "./journal";
import { projectRecoveryRoot, removeProjectFolderRecovery } from "./project-paths";

test("removing project recovery retains a foreign process's journal and lease until it exits", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-recovery-removal-"));
  const owned = projectRecoveryRoot(root, "project");
  const source = ["project", "account", "workspace"];
  await openRecoveryJournal({ root: owned, source }).update({ candidate: null });
  const key = recoveryJournalKey(source);
  const path = join(owned, "sources", `${key}.json`);
  const leasePath = join(owned, "sources", `${key}.lock.sqlite`);
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "journal-owner.fixture.ts"), owned], {
    stdout: "pipe",
    stderr: "inherit",
  });
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
    await expect(removeProjectFolderRecovery(root, "project")).rejects.toThrow("Another Prompt Studio process");
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
