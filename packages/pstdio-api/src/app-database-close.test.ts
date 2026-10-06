import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeBeforeFatalExit } from "./app";
import { createTestApp } from "./test-utils/create-test-app";

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
