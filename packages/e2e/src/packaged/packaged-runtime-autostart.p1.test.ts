import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupDirs, createGitRepo } from "../cli/helpers";
import { getFreePort } from "../cli/start-api";
import { TEST_TIMEOUT } from "../cli/timeouts";
import { runPackagedAsync, runPackagedSafe } from "./packaged-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();
const dirs: string[] = [];
afterAll(() => cleanupDirs(dirs));

describe("packaged pstdio — auto-start", () => {
  test(
    "keeps the detached API alive after the launcher exits",
    async () => {
      const port = await getFreePort();
      const url = `http://localhost:${port}`;
      const repo = createGitRepo();
      const homePath = mkdtempSync(join(tmpdir(), "pstdio-packaged-autostart-home-"));
      dirs.push(repo, homePath);

      try {
        const output = await runPackagedAsync(["projects", "create", "packaged-autostart"], repo, {
          PSTDIO_API_PORT: String(port),
          PSTDIO_API_URL: url,
          PSTDIO_DB_PATH: ":memory:",
          PSTDIO_DISABLE_API_AUTO_START: "0",
          PSTDIO_HOME: homePath,
          PSTDIO_LOG_LEVEL: "info",
          PSTDIO_STORAGE_PATH: join(homePath, "storage"),
        });
        expect(output).toContain("packaged-autostart");

        for (let request = 0; request < 3; request += 1) {
          const response = await fetch(`${url}/healthz`);
          expect(response.ok).toBe(true);
          await Bun.sleep(50);
        }
      } finally {
        runPackagedSafe("close", repo, { PSTDIO_HOME: homePath });
      }
    },
    TEST_TIMEOUT,
  );
});
