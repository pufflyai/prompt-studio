import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const lockModule = new URL("./pglite-lock.ts", import.meta.url).href;

const waitForResults = async (resultPaths: string[]) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (resultPaths.every((resultPath) => fs.existsSync(resultPath))) {
      return resultPaths.map((resultPath) => fs.readFileSync(resultPath, "utf8"));
    }
    await Bun.sleep(5);
  }
  throw new Error("Timed out waiting for lock contenders");
};

describe("acquirePgliteLock", () => {
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
  });
});
