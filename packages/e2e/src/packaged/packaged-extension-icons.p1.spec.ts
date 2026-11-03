import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

// SVG brand colors and theme-responsive monochrome marks must stay visible in both app themes.
test("packaged extension SVG images preserve color and follow the embedding app theme", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-extension-icons-"));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><style>svg{color:#000}@media(prefers-color-scheme:dark){svg{color:#fff}}</style><path fill="red" d="M0 0h10v20H0z"/><path fill="currentColor" d="M10 0h10v20H10z"/></svg>';
    const icon = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    const catalog = join(root, "catalog.json");
    writeFileSync(
      catalog,
      JSON.stringify({
        version: 1,
        extensions: [
          {
            installName: "custom-icon",
            extensionId: "acme.custom-icon",
            displayName: "Custom icon",
            icon,
            description: "Theme-aware asset",
            default: false,
            origin: { kind: "git", url: "https://example.com/tools.git", ref: "main", path: "tool" },
          },
        ],
      }),
    );
    const runtime = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_EXTENSION_CATALOG: catalog,
    });
    child = runtime.child;
    mkdirSync(join(root, "project"));
    const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Custom icon" }, join(root, "project"))),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    browser = await chromium.launch({ headless: true, ...PROVISIONED_CHROMIUM });
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, runtime.descriptor);
    await page.goto(`${runtime.baseUrl}/projects/${project.id}/extensions`);
    const image = page
      .getByTestId("marketplace-extension-entry")
      .filter({ hasText: "acme.custom-icon" })
      .locator("img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(value);
      }, theme);
      await expect(image).toHaveCSS("color-scheme", theme);
      const screenshot = await image.screenshot();
      const colors = await page.evaluate(async (png) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        return [0.25, 0.75].map((x) =>
          Array.from(ctx.getImageData(Math.floor(bitmap.width * x), Math.floor(bitmap.height / 2), 1, 1).data),
        );
      }, screenshot.toString("base64"));
      expect(colors[0]).toEqual([255, 0, 0, 255]);
      expect(colors[1]).toEqual(theme === "dark" ? [255, 255, 255, 255] : [0, 0, 0, 255]);
    }
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { force: true, recursive: true });
  }
});
