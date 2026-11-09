import { globSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

const root = join(import.meta.dirname, "../../../..");
const withExtension = async (
  request: APIRequestContext,
  page: Page,
  name: string,
  run: (projectId: string) => Promise<void>,
) => {
  const folder = mkdtempSync(join(tmpdir(), "pstdio-native-surfaces-"));
  let projectId: string | undefined;
  try {
    const created = await request.post("/v1/projects", {
      data: folderProjectInput({ name: "Native extension surfaces" }, folder),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id as string;
    const source = join(root, ".pstdio/extensions", name);
    const upload = new FormData();
    upload.append("kind", "upload");
    upload.append("folderName", name);
    for (const file of globSync(
      [
        "package.json",
        "extension.ts",
        "merge-queue-repair.ts",
        "src/**/*.ts",
        "src/**/*.tsx",
        "skills/**/*.*",
        "l10n/*.json",
      ],
      { cwd: source },
    ))
      upload.append("files", new File([readFileSync(join(source, file))], file));
    const installed = await request.post(`/v1/projects/${projectId}/extensions/install`, { multipart: upload });
    expect(installed.ok(), await installed.text()).toBe(true);
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await run(projectId);
  } finally {
    try {
      if (projectId) await request.delete(`/v1/projects/${projectId}`);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }
};

// Critical: all destinations and the run form stay reachable through native project navigation and menus.
test("Performance expands in project navigation and Runs retains its native menu draft", async ({ request, page }) => {
  await withExtension(request, page, "pstdio-dev", async (projectId) => {
    const path = `/projects/${projectId}/extensions/pstdio.pstdio-dev`;
    await page.goto(`${path}/performance`);
    const nav = page.locator('[data-workbench-region="sidenav"]');
    const performance = nav.getByRole("option", { name: "Performance", exact: true });
    await performance.focus();
    await performance.press("ArrowRight");
    await expect(performance).toHaveAttribute("aria-expanded", "true");
    for (const name of ["Trends", "Compare", "Runs"]) {
      await nav.getByRole("option", { name, exact: true }).click();
      await expect(page.getByRole("main").locator(`iframe[title="${name}"]`)).toBeVisible();
      await expect(nav.getByRole("option", { name: "Tickets", exact: true })).toBeVisible();
    }
    const menu = page.locator('[data-workbench-panel-menu="main-right"]');
    const form = menu.frameLocator('iframe[title="New run"]');
    const commit = form.getByRole("combobox", { name: "Add a commit, branch, or tag" });
    await commit.fill("retained-run-ref");
    const resize = page.getByRole("separator", { name: "Resize Main right menu", exact: true });
    await resize.focus();
    await resize.press("Home");
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Open Main right menu", exact: true }).click();
    await expect(commit).toHaveValue("retained-run-ref");
    await expect(menu).toBeVisible();
    await page.setViewportSize({ width: 700, height: 1000 });
    await expect(menu).toBeHidden();
    const opener = page.getByRole("button", { name: "Open Main right menu", exact: true });
    await opener.click();
    const floating = page.locator('[data-workbench-panel-menu-controls="main-right-menu"]');
    await expect(floating).toBeVisible();
    const floatingCommit = floating.frameLocator('iframe[title="New run"]').getByRole("combobox");
    await expect(floatingCommit).toHaveValue("retained-run-ref");
    await floatingCommit.fill("retained-floating-ref");
    await opener.click();
    await expect(floating).toBeHidden();
    await expect
      .poll(() =>
        page
          .frameLocator('iframe[title="New run"]')
          .locator("body")
          .evaluate(() => document.hidden),
      )
      .toBe(true);
    await opener.click();
    await expect(floatingCommit).toHaveValue("retained-floating-ref");
    await expect(page.locator('iframe[title="New run"]')).toHaveCount(1);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await expect(commit).toHaveValue("retained-floating-ref");
    await nav.getByRole("option", { name: "Trends", exact: true }).click();
    await expect(page.getByRole("main").locator('iframe[title="Trends"]')).toBeVisible();
    await performance.focus();
    await performance.press("ArrowLeft");
    await expect(performance).toHaveAttribute("aria-expanded", "false");
  });
});

// Critical: closing the native inspector must preserve editable recipe fields and the preview.
test("Shape Art's native settings menu closes and reopens without losing its draft", async ({ request, page }) => {
  await withExtension(request, page, "shape-art", async (projectId) => {
    await page.goto(`/projects/${projectId}/extensions/pstdio.shape-art/shape-art`);
    const menu = page.locator('[data-workbench-panel-menu="main-right"]');
    const seed = menu.getByRole("textbox", { name: "Seed", exact: true });
    await seed.fill("retained-native-art");
    await seed.press("Tab");
    await expect
      .poll(async () => {
        const response = await request.post(
          `/v1/projects/${projectId}/extensions/commands/pstdio.shape-art.command.studio.read/execute`,
          { data: { params: {}, source: "api" } },
        );
        return (await response.json()).outcome.value?.recipe.seed;
      })
      .toBe("retained-native-art");
    const resize = page.getByRole("separator", { name: "Resize Main right menu", exact: true });
    await resize.focus();
    await resize.press("Home");
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Open Main right menu", exact: true }).click();
    await expect(seed).toHaveValue("retained-native-art");
    await page.reload();
    await expect(seed).toHaveValue("retained-native-art");
    await expect(
      page.frameLocator('iframe[title="Shape Art"]').getByRole("button", { name: "Save", exact: true }),
    ).toBeEnabled();
  });
});
