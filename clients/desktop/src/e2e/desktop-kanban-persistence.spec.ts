import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { removeTestDirectory } from "../testing/remove-test-directory";

// Run against the isolated Docker dashboard. Retain the Electron profile while
// replacing its memory-only renderer session, just as a desktop restart does.
test("restores named ticket views across desktop process restarts", async () => {
  test.skip(!process.env.PSTDIO_TICKET_VIEW_URL, "Requires the isolated Docker dashboard");
  const root = mkdtempSync(join(process.cwd(), "test-results/kanban-profile-"));
  const entry = join(root, "main.mjs");
  execFileSync("bun", [
    "build",
    "src/e2e/kanban-persistence-fixture.ts",
    "--outfile",
    entry,
    "--target=node",
    "--format=esm",
    "--external=electron",
  ]);
  execFileSync("bun", [
    "build",
    "src/preload.ts",
    "--outfile",
    join(root, "preload.cjs"),
    "--target=node",
    "--format=cjs",
    "--external=electron",
  ]);
  const launch = (url = process.env.PSTDIO_TICKET_VIEW_URL!) =>
    electron.launch({
      args: [entry, `--user-data-dir=${join(root, "profile")}`],
      env: { ...process.env, PSTDIO_TICKET_VIEW_URL: url },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Add view", exact: true }).click();
    await page.getByRole("tab", { name: "View 2", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.getByRole("textbox", { name: "View name" }).fill("Desktop restart check");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await expect
      .poll(() => readFileSync(join(root, "profile/workbench-state.json"), "utf8"))
      .toContain("Desktop restart check");
    await page.getByRole("button", { name: "Display settings", exact: true }).click();
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.getByText("Archived is", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Save view", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    const savedViews = JSON.parse(readFileSync(join(root, "profile/workbench-state.json"), "utf8")).kanbanViews;
    await page.screenshot({ path: join(root, "before.png") });
    await app.close();
    const nextOrigin = new URL(process.env.PSTDIO_TICKET_VIEW_URL!);
    nextOrigin.hostname = "localhost";
    app = await launch(nextOrigin.href);
    page = await app.firstWindow();
    await expect(page.getByRole("tab", { name: "Desktop restart check", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(JSON.parse(readFileSync(join(root, "profile/workbench-state.json"), "utf8")).kanbanViews).toEqual(
      savedViews,
    );
    await page.reload();
    await expect(page.getByRole("tab", { name: "Desktop restart check", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.screenshot({ path: join(root, "after.png") });
    await test.info().attach("restored-view", { path: join(root, "after.png"), contentType: "image/png" });
    await page.getByRole("tab", { name: "Desktop restart check", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete view", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("tab", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Desktop restart check", exact: true })).toHaveCount(0);
  } finally {
    await app.close();
    await removeTestDirectory(root);
  }
});
