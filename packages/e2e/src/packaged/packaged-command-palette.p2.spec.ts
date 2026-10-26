import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { changeThemeThroughCommandPalette } from "../ui/helpers/theme-picker";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test("the packaged command palette changes and saves the theme", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-command-palette-"));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const started = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
    child = started.child;
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Packaged theme picker" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("onboarding-complete", "true");
      if (!localStorage.getItem("theme-preference")) localStorage.setItem("theme-preference", "pstdio-dark");
    });
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/`);
    await expect(page.getByRole("button", { name: "Help", exact: true })).toBeVisible();
    await changeThemeThroughCommandPalette(page);
    await page.screenshot({ path: test.info().outputPath("theme-changed.png") });
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
