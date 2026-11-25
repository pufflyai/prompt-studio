import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { projectUpgradeLimitMs } from "pstdio-scripts/testing";
import { test as packaged } from "../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  runPackagedCli,
  waitForExit,
} from "./packaged-app-helpers";
import { openPackagedProject } from "./packaged-project-helpers";

type Profile = "history" | "storage";
const fixture = resolve(import.meta.dirname, "../../../../packages/e2e/src/packaged/desktop-upgrade.fixture.ts");
const test = packaged.extend<{ profile: Profile; upgradeHome: string }>({
  profile: ["history", { option: true }],
  upgradeHome: [
    async ({ profile, packagedResources: _resources }, use) => {
      const home = createPackagedHome();
      execFileSync("bun", [fixture, "seed", home, profile], { stdio: "inherit" });
      await use(home);
    },
    { timeout: 300_000 },
  ],
});

for (const profile of ["history", "storage"] as const)
  test.describe(profile, () => {
    test.use({ profile });
    test("completes the upgrade, opens the project and persists an edit within the upgrade budget", async ({
      upgradeHome,
    }, info) => {
      let app: PackagedApp | undefined;
      try {
        const started = performance.now();
        const opened = await test.step(
          "Launch, open the existing project and save an edit",
          async () => {
            const opened = await launchPackagedApp(upgradeHome, {
              PSTDIO_DEFAULT_EXTENSIONS: "[]",
              ...(profile === "storage" ? { PSTDIO_TEST_SETTLED_MIGRATION: "1" } : {}),
            });
            app = opened;
            await openPackagedProject(opened.page, { id: "upgrade-repro", name: "Upgrade fixture" });
            const name = await opened.page.evaluate(async () => {
              const headers = {
                "content-type": "application/json",
                authorization: `Bearer ${localStorage.getItem("pstdio.browserSession")}`,
              };
              const path = "/v1/projects/upgrade-repro";
              const write = await fetch(path, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ name: "Verified upgrade" }),
              });
              if (!write.ok) throw new Error(`Project edit returned HTTP ${write.status}`);
              const read = await fetch(path, { headers });
              if (!read.ok) throw new Error(`Project read returned HTTP ${read.status}`);
              return (await read.json()).name;
            });
            expect(name).toBe("Verified upgrade");
            return opened;
          },
          { timeout: projectUpgradeLimitMs },
        );
        const elapsedMs = performance.now() - started;
        await info.attach("upgrade-to-usable-project.json", {
          body: JSON.stringify({ profile, elapsedMs, limitMs: projectUpgradeLimitMs }),
          contentType: "application/json",
        });
        expect(elapsedMs).toBeLessThanOrEqual(projectUpgradeLimitMs);
        await opened.finishTrace();
        expect((await runPackagedCli(upgradeHome, ["close"])).exitCode).toBe(0);
        await waitForExit(opened.child);
        await disposePackagedApp(opened);
        app = undefined;
        execFileSync("bun", [fixture, "verify", upgradeHome, profile], { stdio: "inherit" });
      } finally {
        if (app) await disposePackagedApp(app);
      }
    });
  });
