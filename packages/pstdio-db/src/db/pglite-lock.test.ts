import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const lockModule = new URL("./pglite-lock.ts", import.meta.url).href;

const waitForResults = async (resultPaths: string[], attempts = 200) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (resultPaths.every((resultPath) => fs.existsSync(resultPath))) {
      return resultPaths.map((resultPath) => fs.readFileSync(resultPath, "utf8"));
    }
    await Bun.sleep(5);
  }
  throw new Error("Timed out waiting for lock contenders");
};

const waitForClaim = async (lockPath: string, suffix: string) => {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const claim = fs.readdirSync(lockPath).find((name) => name.endsWith(suffix));
    if (claim) {
      return path.join(lockPath, claim);
    }
    await Bun.sleep(5);
  }
  throw new Error(`Timed out waiting for ${suffix} claim`);
};

describe("acquirePgliteLock", () => {
  it("reports the active owner even when its waiting claim cannot be removed", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-lock-cleanup-"));
    const dbPath = path.join(tempRoot, "database");
    const lockPath = `${dbPath}.lock`;
    const choosingPath = path.join(lockPath, `${process.pid}-blocker.choosing`);
    const resultPath = path.join(tempRoot, "result");
    fs.mkdirSync(dbPath);
    fs.mkdirSync(lockPath);
    fs.writeFileSync(
      path.join(lockPath, `${process.pid}-active.active`),
      JSON.stringify({
        id: "active",
        pid: process.pid,
        process: "pstdio serve",
        startedAt: "2026-07-17T10:00:00.000Z",
        ticket: 1,
      }),
    );
    fs.writeFileSync(
      choosingPath,
      JSON.stringify({ id: "blocker", pid: process.pid, process: "pstdio serve", startedAt: "", ticket: 0 }),
    );

    const script = `
      import fs from "node:fs";
      import { acquirePgliteLock } from ${JSON.stringify(lockModule)};
      const [dbPath, resultPath] = process.argv.slice(1);
      try {
        acquirePgliteLock(dbPath);
      } catch (error) {
        fs.writeFileSync(resultPath, error instanceof Error ? error.message : String(error));
      }
    `;
    const contender = Bun.spawn([process.execPath, "-e", script, dbPath, resultPath]);

    try {
      const waitingPath = await waitForClaim(lockPath, ".waiting");
      fs.rmSync(waitingPath);
      fs.mkdirSync(waitingPath);
      fs.writeFileSync(path.join(waitingPath, "keep"), "claim cleanup must fail");
      fs.rmSync(choosingPath);

      const [message] = await waitForResults([resultPath]);
      await contender.exited;

      expect(message).toMatch(/pstdio\.db is in use by pid .*refusing to open it a second time/);
    } finally {
      contender.kill();
      await contender.exited;
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it("times out when a live contender remains in the choosing phase", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-lock-timeout-"));
    const dbPath = path.join(tempRoot, "database");
    const lockPath = `${dbPath}.lock`;
    const resultPath = path.join(tempRoot, "result");
    fs.mkdirSync(dbPath);
    fs.mkdirSync(lockPath);
    fs.writeFileSync(
      path.join(lockPath, `${process.pid}-blocker.choosing`),
      JSON.stringify({ id: "blocker", pid: process.pid, process: "stalled pstdio", startedAt: "", ticket: 0 }),
    );

    const script = `
        import fs from "node:fs";
        import { acquirePgliteLock } from ${JSON.stringify(lockModule)};
        const [dbPath, resultPath] = process.argv.slice(1);
        try {
          acquirePgliteLock(dbPath);
        } catch (error) {
          fs.writeFileSync(resultPath, error instanceof Error ? error.message : String(error));
        }
      `;
    const contender = Bun.spawn([process.execPath, "-e", script, dbPath, resultPath]);

    try {
      const [message] = await waitForResults([resultPath], 1_200);
      await contender.exited;

      expect(message).toMatch(/timed out.*choosing.*pstdio\.db lock/i);
      expect(fs.readdirSync(lockPath).some((name) => name.endsWith(".waiting"))).toBe(false);
    } finally {
      contender.kill();
      await contender.exited;
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
  }, 10_000);

  it("elects only one owner when processes race to reclaim a stale lock", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-lock-race-"));
    try {
      for (let iteration = 0; iteration < 150; iteration += 1) {
        const iterationRoot = path.join(tempRoot, String(iteration));
        const dbPath = path.join(iterationRoot, "database");
        const lockPath = `${dbPath}.lock`;
        const gatePath = path.join(iterationRoot, "start");
        const releasePath = path.join(iterationRoot, "release");
        fs.mkdirSync(dbPath, { recursive: true });
        fs.mkdirSync(lockPath);
        fs.writeFileSync(
          path.join(lockPath, "999999999-dead-owner.active"),
          JSON.stringify({ id: "dead-owner", pid: 999_999_999, ticket: 1 }),
        );

        const contenders = ["a", "b"].map((name) => {
          const resultPath = path.join(iterationRoot, `${name}.result`);
          const script = `
            import fs from "node:fs";
            import { acquirePgliteLock } from ${JSON.stringify(lockModule)};
            const [dbPath, gatePath, releasePath, resultPath] = process.argv.slice(1);
            while (!fs.existsSync(gatePath)) await Bun.sleep(1);
            try {
              const release = acquirePgliteLock(dbPath);
              fs.writeFileSync(resultPath, "acquired");
              while (!fs.existsSync(releasePath)) await Bun.sleep(1);
              release();
            } catch {
              fs.writeFileSync(resultPath, "rejected");
            }
          `;
          return {
            process: Bun.spawn([process.execPath, "-e", script, dbPath, gatePath, releasePath, resultPath]),
            resultPath,
          };
        });

        fs.writeFileSync(gatePath, "go");
        const results = await waitForResults(contenders.map(({ resultPath }) => resultPath));
        fs.writeFileSync(releasePath, "done");
        await Promise.all(contenders.map(({ process: contender }) => contender.exited));

        expect(results.sort(), `iteration ${iteration}`).toEqual(["acquired", "rejected"]);
      }
    } finally {
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
  }, 30_000);
});
