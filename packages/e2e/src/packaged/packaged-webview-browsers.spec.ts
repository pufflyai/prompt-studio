import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  type Browser,
  type BrowserType,
  chromium,
  expect,
  firefox,
  type LaunchOptions,
  test,
  webkit,
} from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { verifyTreeGroups } from "../helpers/tree-groups";
import { logTestPhase } from "../scripts/log-test-phase";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { verifyPackagedTerminal } from "./packaged-browser-terminal";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { verifyPackagedCollectionBreadcrumb } from "./packaged-collection-breadcrumb";
import { verifyPackagedDocumentState } from "./packaged-document-state";
import { buildBinary } from "./packaged-helpers";
import { verifyPackagedNoteHeadings } from "./packaged-note-headings";
import { verifyPackagedPageModes, withPageModeProbe } from "./packaged-page-modes";
import { verifyPackagedPanelMenuTabs } from "./packaged-panel-menu-tabs";
import { verifyPackagedPreviewSelection } from "./packaged-preview-selection";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { verifyPackagedSessionMenus } from "./packaged-session-menus";
import { verifyPackagedShortcutReference } from "./packaged-shortcut-reference";
import { verifyPackagedViewInitialization } from "./packaged-webview-initialization";
import { verifyPackagedWebviewRetention } from "./packaged-webview-retention";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);

const REQUIRE_WEBVIEW_BROWSERS = process.env.E2E_REQUIRE_WEBVIEW_BROWSERS === "1";
// Package verification does not install Playwright browsers on every release runner.
// The required CI job opts out of skips through E2E_REQUIRE_WEBVIEW_BROWSERS.
const webviewBrowsers: { launchOptions?: LaunchOptions; name: string; type: BrowserType }[] = [
  { launchOptions: PROVISIONED_CHROMIUM, name: "Chromium", type: chromium },
  {
    launchOptions: { firefoxUserPrefs: { "network.cookie.cookieBehavior": 5 } },
    name: "Firefox",
    type: firefox,
  },
  { name: "WebKit (Safari engine)", type: webkit },
];

const findLabWebview = (metadata: WorkbenchExtensionMetadata) => {
  const labPage = metadata.pages.find((page) => page.path === "lab");
  if (labPage?.main.kind !== "view") return undefined;
  const ref = labPage.main.view;
  const view = metadata.views.find((view) => view.localId === ref.id && view.extensionId === ref.extensionId);
  return view?.body.kind === "webview" ? view.body : undefined;
};

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test.describe("packaged extension webviews", () => {
  for (const browserCase of webviewBrowsers) {
    const browserAvailable = existsSync(browserCase.type.executablePath());
    const defaultExtensions = e2eExtensions(
      "workbench-fixture",
      ...(browserCase.name === "Chromium" ? ["pstdio-artifacts", "pstdio-notes"] : []),
    );
    const browserTest = browserAvailable || REQUIRE_WEBVIEW_BROWSERS ? test : test.skip;

    browserTest(
      `persists commands and settings through authenticated opaque webviews in ${browserCase.name}`,
      async () => {
        const startedAt = Date.now();
        const phase = (name: string) =>
          logTestPhase(`Packaged ${browserCase.name} ${name} (${Date.now() - startedAt}ms)`);
        phase("runtime start");
        const tempRoot = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-packaged-webview-")));
        let child: ChildProcess | null = null;
        let browser: Browser | null = null;

        try {
          expect(browserAvailable).toBe(true);
          const started = await startPackagedServe(tempRoot, {
            PSTDIO_DEFAULT_EXTENSIONS: withPageModeProbe(defaultExtensions, tempRoot, browserCase.name === "Chromium"),
            PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
          });
          child = started.child;

          const projectFolder = join(tempRoot, "project");
          mkdirSync(projectFolder);
          const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
            body: JSON.stringify(folderProjectInput({ name: "packaged-extension-webview" }, projectFolder)),
            headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
            method: "POST",
          });
          expect(createRes.status).toBe(201);
          const project = (await createRes.json()) as { id: string };

          let labWebview: Extract<WorkbenchExtensionMetadata["views"][number]["body"], { kind: "webview" }> | undefined;
          const deadline = Date.now() + 30_000;
          while (Date.now() < deadline) {
            const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
              headers: runtimeAuthorization(started.descriptor),
            });
            expect(metadataRes.status).toBe(200);
            const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
            labWebview = findLabWebview(metadata);
            if (labWebview?.webview.moduleUrl) {
              const moduleRes = await fetch(`${started.baseUrl}${labWebview.webview.moduleUrl}`, {
                headers: runtimeAuthorization(started.descriptor),
              });
              if (moduleRes.ok) break;
            }
            await sleep(250);
          }
          expect(labWebview?.webview.moduleUrl).toBeTruthy();
          phase("runtime ready");

          browser = await browserCase.type.launch({ headless: true, ...browserCase.launchOptions });
          const context = await browser.newContext();
          const page = await context.newPage();
          page.setDefaultTimeout(10_000);
          page.setDefaultNavigationTimeout(10_000);
          const extensionAssetStatuses: number[] = [];
          const authenticationFailures: string[] = [];
          page.on("response", (response) => {
            const pathname = new URL(response.url()).pathname;
            if (pathname.startsWith("/v1/extensions/")) {
              extensionAssetStatuses.push(response.status());
            }
            if (pathname.startsWith("/v1/") && [401, 403].includes(response.status())) {
              authenticationFailures.push(`${response.status()} ${pathname}`);
            }
          });
          await page.addInitScript(
            ({ projectId }) => {
              localStorage.setItem("onboarding-complete", "true");
              localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
            },
            { projectId: project.id },
          );

          await signInBrowser(page, started.descriptor);
          await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/pstdio.workbench-fixture/lab`, {
            waitUntil: "domcontentloaded",
          });
          const iframe = page.locator('iframe[title="Lab"]');
          await iframe.waitFor({ state: "visible", timeout: 30_000 });
          expect(await iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");

          const frame = page.frameLocator('iframe[title="Lab"]');
          await frame.getByRole("heading", { name: "Sandbox webview" }).waitFor({ timeout: 30_000 });
          await verifyPackagedViewInitialization(page, labWebview!.webview.runtimeUrl);
          await frame.getByRole("button", { name: "Say hello" }).click();
          await page.getByText("Hello from Extension Lab").waitFor({ timeout: 10_000 });

          const bumpResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname.endsWith(
              "/commands/pstdio.workbench-fixture.command.counter.bump/execute",
            ),
          );
          await frame.getByRole("button", { name: "Increment", exact: true }).click();
          expect((await bumpResponse).status()).toBe(200);
          expect(await (await bumpResponse).json()).toMatchObject({
            outcome: { status: "success", value: { counter: 1 } },
          });
          await page.reload();
          await expect(frame.getByText("1", { exact: true })).toBeVisible();
          await frame.getByRole("button", { name: "Read native controls", exact: true }).press("Enter");
          await expect(frame.getByTestId("native-controls-result")).toContainText('"model":"fake"');
          expect(JSON.parse((await frame.getByTestId("native-controls-result").textContent())!)).toMatchObject({
            model: "fake",
            actions: expect.any(Array),
          });
          await verifyPackagedWebviewRetention(page);
          await verifyPackagedShortcutReference(
            page,
            started.baseUrl,
            project.id,
            runtimeAuthorization(started.descriptor),
          );

          await page.getByRole("option", { name: "Settings", exact: true }).click();
          await page.getByRole("dialog").last().getByText("Lab (project)", { exact: true }).click();
          const settingsFrame = page.frameLocator('iframe[title="Lab (project)"]');
          expect(await page.locator('iframe[title="Lab (project)"]').getAttribute("sandbox")).not.toContain(
            "allow-same-origin",
          );
          await settingsFrame.getByRole("spinbutton").fill("7");
          await settingsFrame.getByRole("button", { name: "Save", exact: true }).click();
          await expect(settingsFrame.getByText("Saved", { exact: true })).toBeVisible();

          await page.reload();
          await expect(settingsFrame.getByRole("spinbutton")).toHaveValue("7");
          await page.getByRole("button", { name: "Close Lab (project)", exact: true }).click();
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await page.getByRole("option", { name: "Settings", exact: true }).click();
          await page.getByRole("dialog").last().getByText("Lab (project)", { exact: true }).click();
          await expect(settingsFrame.getByRole("spinbutton")).toHaveValue("7");
          await page.getByRole("button", { name: "Close Lab (project)", exact: true }).click();
          await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/pstdio.workbench-fixture/lab`);
          await expect(frame.getByText("1", { exact: true })).toBeVisible();
          await frame.getByRole("button", { name: "Increment", exact: true }).click();
          await expect(frame.getByText("8", { exact: true })).toBeVisible();

          if (browserCase.name === "Chromium") {
            phase("core checked; notes start");
            await verifyPackagedNoteHeadings(
              page,
              started.baseUrl,
              project.id,
              runtimeAuthorization(started.descriptor),
            );
            phase("notes checked; terminal start");
            await verifyPackagedTerminal(page, started.baseUrl, project.id, started.descriptor.token);
            phase("terminal checked; session menus start");
            await verifyPackagedSessionMenus(
              page,
              started.baseUrl,
              project.id,
              runtimeAuthorization(started.descriptor),
            );
            phase("session menus checked; preview selection start");
            await verifyPackagedPreviewSelection(page, project.id, started.descriptor);
            phase("preview checked; panel menus start");
            await verifyPackagedPanelMenuTabs(page, started.baseUrl, project.id);
            phase("panel menus checked; collection start");
            await verifyPackagedCollectionBreadcrumb(
              page,
              started.baseUrl,
              project.id,
              projectFolder,
              runtimeAuthorization(started.descriptor),
            );
            phase("collection checked; document state start");
            await verifyPackagedDocumentState(page, started.baseUrl, project.id);
            phase("documents checked; page modes start");
            await verifyPackagedPageModes(page, started.baseUrl, project.id);
            phase("page modes checked; tree start");
            await page.goto(`${started.baseUrl}/projects/${project.id}/workspaces`);
            const sidenav = page.locator('[data-workbench-region="sidenav"]');
            await verifyTreeGroups(page, sidenav, sidenav.getByRole("option", { name: "Search", exact: true }));
          }

          expect(extensionAssetStatuses.length).toBeGreaterThanOrEqual(3);
          expect(extensionAssetStatuses.every((status) => status === 200)).toBe(true);
          expect(authenticationFailures).toEqual([]);
          expect((await page.content()).includes(started.descriptor.token)).toBe(false);
          expect((await page.evaluate(() => document.cookie)).includes(started.descriptor.token)).toBe(false);
          phase("checks complete");
        } finally {
          await browser?.close();
          if (child) await stopProcess(child);
          rmSync(tempRoot, { recursive: true, force: true });
        }
      },
    );
  }
});
