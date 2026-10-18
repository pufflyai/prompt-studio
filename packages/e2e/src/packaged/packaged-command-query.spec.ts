import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

test("command queries refresh once per matching event and unsubscribe on unmount", async ({ page }) => {
  const root = mkdtempSync(join(tmpdir(), "command-query-"));
  try {
    await openQueryFixture(page, root);
    await expect(page.locator("#result")).toHaveText("1");
    await expect(page.locator("#subscriptions")).toHaveText("2");
    await page.getByRole("button", { name: "Unrelated", exact: true }).click();
    await expect(page.locator("#calls")).toHaveText("1");
    await page.getByRole("button", { name: "Matching", exact: true }).click();
    await expect(page.locator("#result")).toHaveText("2");
    await page.getByRole("button", { name: "Matching", exact: true }).click();
    await expect(page.locator("#result")).toHaveText("3");
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator("#result")).toHaveText("4");
    await expect(page.locator("#calls")).toHaveText("4");
    await page.getByRole("button", { name: "Unmount", exact: true }).click();
    await expect(page.locator("#subscriptions")).toHaveText("0");
    await page.getByRole("button", { name: "Matching", exact: true }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator("#calls")).toHaveText("4");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const openQueryFixture = async (page: Page, root: string) => {
  const built = spawnSync(
    "bun",
    [
      "build",
      join(import.meta.dirname, "../helpers/command-query.fixture.tsx"),
      "--target=browser",
      `--outdir=${root}`,
    ],
    { encoding: "utf8" },
  );
  expect(built.status, built.stderr).toBe(0);
  await page.route("http://query-fixture.test/**", (route) => {
    if (route.request().url().endsWith("/fixture.js"))
      return route.fulfill({
        contentType: "text/javascript",
        body: readFileSync(join(root, "command-query.fixture.js")),
      });
    return route.fulfill({
      contentType: "text/html",
      body: '<div id="app"></div><pre id="calls">0</pre><pre id="subscriptions">0</pre><button id="unrelated">Unrelated</button><button id="matching">Matching</button><button id="reset">Reset</button><button id="hold">Hold read</button><button id="release">Release read</button><script type="module" src="/fixture.js"></script>',
    });
  });
  await page.goto("http://query-fixture.test/");
};

test("matching events during a pending read queue one fresh read", async ({ page }) => {
  const root = mkdtempSync(join(tmpdir(), "command-query-pending-"));
  try {
    await openQueryFixture(page, root);
    await expect(page.locator("#result")).toHaveText("1");
    await expect(page.locator("#subscriptions")).toHaveText("2");
    await page.getByRole("button", { name: "Hold read", exact: true }).click();
    await expect(page.locator("#calls")).toHaveText("2");
    await page.getByRole("button", { name: "Matching", exact: true }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator("#calls")).toHaveText("2");
    await page.getByRole("button", { name: "Rerender", exact: true }).click();
    await page.getByRole("button", { name: "Release read", exact: true }).click();
    await expect(page.locator("#result")).toHaveText("3");
    await expect(page.locator("#calls")).toHaveText("3");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unmount cancels a queued refresh without restarting its pending read", async ({ page }) => {
  const root = mkdtempSync(join(tmpdir(), "command-query-unmount-"));
  try {
    await openQueryFixture(page, root);
    await expect(page.locator("#result")).toHaveText("1");
    await page.getByRole("button", { name: "Hold read", exact: true }).click();
    await expect(page.locator("#calls")).toHaveText("2");
    await page.getByRole("button", { name: "Matching", exact: true }).click();
    await page.getByRole("button", { name: "Unmount", exact: true }).click();
    await expect(page.locator("#subscriptions")).toHaveText("0");
    await page.getByRole("button", { name: "Release read", exact: true }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator("#calls")).toHaveText("2");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
