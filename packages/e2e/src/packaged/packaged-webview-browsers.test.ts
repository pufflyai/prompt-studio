import { beforeAll, describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, type BrowserType, chromium, firefox, type LaunchOptions, webkit } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const BUILD_TIMEOUT = 180_000;
const WEBVIEW_SMOKE_TEST_TIMEOUT = 120_000;
const REQUIRE_WEBVIEW_BROWSERS = process.env.PSTDIO_REQUIRE_WEBVIEW_BROWSERS === "1";
// Package verification does not install Playwright browsers on every release runner.
// The required CI job opts out of skips through PSTDIO_REQUIRE_WEBVIEW_BROWSERS.
const webviewBrowsers: { launchOptions?: LaunchOptions; name: string; type: BrowserType }[] = [
  { name: "Chromium", type: chromium },
  {
    launchOptions: { firefoxUserPrefs: { "network.cookie.cookieBehavior": 5 } },
    name: "Firefox",
    type: firefox,
  },
  { name: "WebKit (Safari engine)", type: webkit },
];

beforeAll(() => {
  if (!process.env.PSTDIO_PACKAGED_BINARY_PATH) buildBinary();
}, BUILD_TIMEOUT);

describe("packaged extension webviews", () => {
  for (const browserCase of webviewBrowsers) {
    const browserAvailable = existsSync(browserCase.type.executablePath());
    const browserTest = browserAvailable || REQUIRE_WEBVIEW_BROWSERS ? test : test.skip;

    browserTest(
      `loads authenticated opaque-origin assets and calls the host in ${browserCase.name}`,
      async () => {
        const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-webview-"));
        let child: ChildProcess | null = null;
        let browser: Browser | null = null;

        try {
          expect(browserAvailable).toBe(true);
          const started = await startPackagedServe(tempRoot, {
            PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("extension-lab"),
            PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
          });
          child = started.child;

          const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
            body: JSON.stringify({ name: "packaged-extension-webview" }),
            headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
            method: "POST",
          });
          expect(createRes.status).toBe(201);
          const project = (await createRes.json()) as { id: string };

          let labRoute: WorkbenchExtensionMetadata["routes"][number] | undefined;
          const deadline = Date.now() + 30_000;
          while (Date.now() < deadline) {
            const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
              headers: runtimeAuthorization(started.descriptor),
            });
            expect(metadataRes.status).toBe(200);
            const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
            labRoute = metadata.routes.find((route) => route.path === "lab");
            if (labRoute?.webview.moduleUrl) {
              const moduleRes = await fetch(`${started.baseUrl}${labRoute.webview.moduleUrl}`, {
                headers: runtimeAuthorization(started.descriptor),
              });
              if (moduleRes.ok) break;
            }
            await Bun.sleep(250);
          }
          expect(labRoute?.webview.moduleUrl).toBeTruthy();

          browser = await browserCase.type.launch({ headless: true, ...browserCase.launchOptions });
          const page = await browser.newPage();
          const extensionAssetStatuses: number[] = [];
          page.on("response", (response) => {
            if (new URL(response.url()).pathname.startsWith("/v1/extensions/")) {
              extensionAssetStatuses.push(response.status());
            }
          });
          await page.addInitScript(
            ({ projectId }) => {
              localStorage.setItem("onboarding-complete", "true");
              localStorage.setItem("dashboard-wb:selected-project:global", projectId);
            },
            { projectId: project.id },
          );

          await page.goto(`${started.baseUrl}/projects/${project.id}/lab`, { waitUntil: "domcontentloaded" });
          const iframe = page.locator('iframe[title="Lab"]');
          await iframe.waitFor({ state: "visible", timeout: 30_000 });
          expect(await iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");

          const frame = page.frameLocator('iframe[title="Lab"]');
          await frame.getByRole("heading", { name: "Sandbox webview" }).waitFor({ timeout: 30_000 });
          await frame.getByRole("button", { name: "Say hello" }).click();
          await page.getByText("Hello from Extension Lab").waitFor({ timeout: 10_000 });

          expect(extensionAssetStatuses.length).toBeGreaterThanOrEqual(3);
          expect(extensionAssetStatuses.every((status) => status === 200)).toBe(true);
        } finally {
          await browser?.close();
          if (child) await stopProcess(child);
          rmSync(tempRoot, { recursive: true, force: true });
        }
      },
      WEBVIEW_SMOKE_TEST_TIMEOUT,
    );
  }
});
