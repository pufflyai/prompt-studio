import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, _electron as electron, expect, test } from "@playwright/test";
import { removeTestDirectory } from "../testing/remove-test-directory";
import { timeVisibleChange } from "./visible-element-timing";

const require = createRequire(import.meta.url);

// Critical: a transient recovery frame must survive delayed delivery back to the test driver.
test("records a visible recovery frame before the triggering operation returns", async () => {
  const root = mkdtempSync(join(tmpdir(), "desktop-visible-frame-"));
  let application: ElectronApplication | undefined;
  try {
    const build = spawnSync("bun", [
      "build",
      join(import.meta.dirname, "visibility-timing-fixture.ts"),
      "--outfile",
      join(root, "main.mjs"),
      "--target=node",
      "--format=esm",
      "--external=electron",
    ]);
    expect(build.status, build.stderr.toString()).toBe(0);
    const env = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    delete env.ELECTRON_RUN_AS_NODE;
    application = await electron.launch({
      executablePath: require("electron") as string,
      args: [join(root, "main.mjs"), `--user-data-dir=${join(root, "profile")}`],
      env,
    });
    const page = await application.firstWindow();
    await page.waitForURL(/^data:text\/html,/);
    await page.setContent('<main role="status"><h1 hidden>Opening Prompt Studio</h1></main>');
    let hiddenAt = 0;
    const timing = await timeVisibleChange(page, '[role="status"] h1', "Opening Prompt Studio", async () => {
      hiddenAt = await page.evaluate(async () => {
        const heading = document.querySelector("h1")!;
        heading.hidden = false;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        heading.hidden = true;
        return Date.now();
      });
    });
    await expect(page.getByRole("heading")).not.toBeVisible();
    expect(timing.visibleAt).toBeGreaterThanOrEqual(timing.startedAt);
    expect(timing.visibleAt).toBeLessThanOrEqual(hiddenAt);
  } finally {
    await application?.close();
    await removeTestDirectory(root);
  }
});
