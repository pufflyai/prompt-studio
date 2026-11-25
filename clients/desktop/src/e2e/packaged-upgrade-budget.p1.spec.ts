import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { projectUpgradeLimitMs } from "pstdio-scripts/testing";
import { test } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
  runPackagedCli,
  waitForExit,
} from "./packaged-app-helpers";
import { openPackagedProject } from "./packaged-project-helpers";

const fixture = resolve(
  import.meta.dirname,
  "../../../../packages/e2e/src/packaged/desktop-upgrade-history.fixture.ts",
);

test("completes an upgrade and can open, edit and read back a saved project within 12 seconds", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    execFileSync("bun", [fixture, "seed", home]);
    const start = performance.now();
    app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    await openPackagedProject(app.page, { id: "upgrade-repro", name: "Upgrade fixture" });
    const saved = await app.page.evaluate(async () => {
      const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${localStorage.getItem("pstdio.browserSession")}`,
      };
      const path = "/v1/projects/upgrade-repro";
      const write = await fetch(path, { method: "PATCH", headers, body: JSON.stringify({ name: "Verified upgrade" }) });
      if (!write.ok) throw new Error(`Project edit returned HTTP ${write.status}`);
      const read = await fetch(path, { headers });
      if (!read.ok) throw new Error(`Project read returned HTTP ${read.status}`);
      return (await read.json()).name;
    });
    const elapsedMs = performance.now() - start;
    expect(saved).toBe("Verified upgrade");
    await testInfo.attach("upgrade-to-usable-project.json", {
      body: JSON.stringify({ elapsedMs, limitMs: projectUpgradeLimitMs, historyRows: 90_000, historySources: 90_000 }),
      contentType: "application/json",
    });
    expect(elapsedMs).toBeLessThanOrEqual(projectUpgradeLimitMs);
    await app.finishTrace();
    expect((await runPackagedCli(home, ["close"])).exitCode).toBe(0);
    await waitForExit(app.child);
    await disposePackagedApp(app);
    app = null;
    execFileSync("bun", [fixture, "verify", home]);
  } finally {
    if (app) await disposePackagedApp(app);
    await removePackagedHome(home);
  }
});
