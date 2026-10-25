import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { writeWebviewSettingsExtension } from "../helpers/webview-settings-extension";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test("typed webview settings delete restores the fallback across reloads", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-settings-reset-"));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    writeWebviewSettingsExtension(root);
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
    });
    child = started.child;
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Settings reset" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/test.settings-fixture/settings`);
    const frame = page.frameLocator('iframe[title="Settings fixture"]');
    await expect(frame.locator("output")).toHaveText("comfortable");
    await expect(frame.locator("#all")).toHaveText('{"density":"comfortable"}');
    const hostProps = JSON.parse((await frame.locator("#props").textContent())!);
    expect(hostProps).toMatchObject({ projectId: project.id, locale: "en", translations: "en" });
    expect(hostProps.keys).toEqual(
      expect.arrayContaining([
        "projectId",
        "themePreference",
        "locale",
        "resource",
        "pageLocation",
        "pageParams",
        "translations",
      ]),
    );
    await expect(frame.locator("#page")).toHaveText('{"tab":"overview"}');
    await frame.getByRole("button", { name: "Update page", exact: true }).click();
    await expect(frame.locator("#page")).toHaveText('{"tab":"files"}');
    await frame.getByRole("button", { name: "Undeclared navigation", exact: true }).click();
    await expect(frame.locator("#details")).toHaveText(
      '{"code":"undeclared_webview_capability","data":{"capability":"navigation.open"}}',
    );
    await frame.getByRole("button", { name: "Invalid setting", exact: true }).click();
    await expect(frame.locator("#validation")).toHaveText("Invalid parameters for extension.settings.set.");
    const invalid = JSON.parse((await frame.locator("#details").textContent())!);
    expect(invalid).toMatchObject({
      code: "invalid_params",
      data: { capability: "extension.settings.set", issues: [{ path: ["key"] }] },
    });
    await expect(frame.locator("output")).toHaveText("comfortable");
    await frame.getByRole("button", { name: "Use compact", exact: true }).click();
    await expect(frame.locator("#saved")).toHaveText("compact");
    await expect(frame.locator("output")).toHaveText("compact");
    await expect(frame.locator("#all")).toHaveText('{"density":"compact"}');
    await page.reload();
    await expect(frame.locator("output")).toHaveText("compact");
    await frame.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(frame.locator("output")).toHaveText("comfortable");
    await page.reload();
    await expect(frame.locator("output")).toHaveText("comfortable");
    await page.screenshot({ path: test.info().outputPath("settings-reset.png") });
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
