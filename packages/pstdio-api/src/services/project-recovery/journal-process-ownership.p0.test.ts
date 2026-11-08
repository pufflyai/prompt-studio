import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openRecoveryJournal } from "./journal";

test("a live source owner keeps its lease through a stale heartbeat and process death releases it", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-journal-owner-"));
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "journal-owner.fixture.ts"), root], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const ready = child.stdout.getReader();
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let release: (() => Promise<void>) | null = null;
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
    const [lock] = (await readdir(join(root, "sources"))).filter((name) => name.endsWith(".lock"));
    const old = new Date(Date.now() - 10 * 60_000);
    await utimes(join(root, "sources", lock!), old, old);
    const journal = await openRecoveryJournal({ root, source: ["project", "account", "workspace"] });
    release = await journal.acquire();
    expect(release).toBeNull();
    child.kill("SIGKILL");
    await child.exited;
    release = await journal.acquire();
    expect(release).not.toBeNull();
  } finally {
    clearTimeout(watchdog);
    child.kill("SIGKILL");
    await child.exited;
    ready.releaseLock();
    await release?.();
    await rm(root, { recursive: true, force: true });
  }
});
