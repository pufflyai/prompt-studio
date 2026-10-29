import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { test } from "../scripts/playwright-test";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { writeWebviewOverlayFixture } from "./webview-overlay-fixture";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("isolated narrow webviews show host overlays with actions, focus and disposal", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-webview-overlays-")));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const source = writeWebviewOverlayFixture(root);
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "overlay-probe" }]),
    });
    child = started.child;
    const folder = join(root, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Webview overlays" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/test.overlay-probe/overlay`);
    const iframe = page.locator('iframe[title="Overlay tools"]');
    const tools = page.frameLocator('iframe[title="Overlay tools"]');
    await tools.getByRole("button", { name: "Tip", exact: true }).click();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    const frameBounds = (await iframe.boundingBox())!;
    const tooltipBounds = (await tooltip.boundingBox())!;
    expect(tooltipBounds.x + tooltipBounds.width).toBeGreaterThan(frameBounds.x + frameBounds.width);
    expect(await iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");

    const menu = tools.getByRole("button", { name: "Menu", exact: true });
    await menu.click();
    await expect(page.getByRole("menu", { name: "Overlay actions" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Disabled layer" })).toHaveAttribute("data-disabled");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(menu).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Apply layer", exact: true }).click();
    await expect(tools.getByRole("status", { name: "Overlay result" })).toHaveText("apply");
    await expect(menu).toBeFocused();

    const info = tools.getByRole("button", { name: "Info", exact: true });
    await info.click();
    const action = page.getByRole("button", { name: "Confirm layer" });
    await expect(action).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(info).toBeFocused();
    await info.click();
    await expect(action).toBeFocused();
    await page.locator('iframe[title="Overlay canvas"]').click({ position: { x: 600, y: 500 } });
    await expect(action).toHaveCount(0);
    await info.click();
    await expect(action).toBeVisible();
    await page.goto(`${started.baseUrl}/projects/${project.id}/`);
    await expect(action).toHaveCount(0);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
