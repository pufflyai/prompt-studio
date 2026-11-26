import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { freshInstallLimitMs, local049UpgradeLimitMs } from "pstdio-scripts/testing";
import { test as packaged } from "../../testing/packaged-fixture";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  runPackagedCli,
  waitForExit,
} from "../packaged-app-helpers";
import { createPackagedProject, openPackagedProject } from "../packaged-project-helpers";

type Profile = "history" | "local-storage";
const fixture = resolve(import.meta.dirname, "../../../../../packages/e2e/src/packaged/desktop-upgrade.fixture.ts");
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

packaged(
  "a fresh install opens its first project with the default tools in under ten seconds",
  async ({ packagedResources: _resources }, info) => {
    const home = createPackagedHome();
    const started = performance.now();
    let app: PackagedApp | undefined;
    let elapsedMs: number | undefined;
    try {
      app = await launchPackagedApp(home, { PSTDIO_DEFAULT_EXTENSIONS: "" });
      const project = await createPackagedProject(app, "First project");
      await openPackagedProject(app.page, project);
      await expect(app.page.frameLocator('iframe[title="Home"]:visible').getByTestId("start-page")).toBeVisible();
      elapsedMs = performance.now() - started;
      expect(elapsedMs).toBeLessThan(freshInstallLimitMs);
    } finally {
      await info.attach("fresh-install-to-usable-project.json", {
        body: JSON.stringify({
          completed: elapsedMs !== undefined,
          elapsedMs: elapsedMs ?? performance.now() - started,
          limitMs: freshInstallLimitMs,
        }),
        contentType: "application/json",
      });
      if (app) await disposePackagedApp(app);
    }
  },
);

for (const profile of ["history", "local-storage"] as const)
  test.describe(profile, () => {
    test.use({ profile });
    test("completes the upgrade, opens the project and persists an edit within the upgrade budget", async ({
      upgradeHome,
    }, info) => {
      let app: PackagedApp | undefined;
      try {
        const started = performance.now();
        let elapsedMs: number | undefined;
        const opened = await test
          .step("Launch, open the existing project and save an edit", async () => {
            const opened = await launchPackagedApp(upgradeHome, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
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
            elapsedMs = performance.now() - started;
            return opened;
          })
          .finally(() =>
            info.attach("upgrade-to-usable-project.json", {
              body: JSON.stringify({
                profile,
                completed: elapsedMs !== undefined,
                elapsedMs: elapsedMs ?? performance.now() - started,
                limitMs: local049UpgradeLimitMs,
              }),
              contentType: "application/json",
            }),
          );
        expect(elapsedMs).toBeLessThanOrEqual(local049UpgradeLimitMs);
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
