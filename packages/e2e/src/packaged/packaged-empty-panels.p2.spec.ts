import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { homeFrame, verifyPageHeaders } from "../helpers/home-loading";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { verifyEmptyPanelAddition } from "./packaged-empty-panel-addition";
import { buildBinary } from "./packaged-helpers";
import { verifyPanelInsertionTargets } from "./packaged-panel-insertion";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("adding a tool keeps the other empty panel open", async () => {
  const startedAt = Date.now();
  const phase = (name: string) => console.log(`Packaged empty panels: ${name} (${Date.now() - startedAt}ms)`);
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-empty-panels-")));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  let diagnosticPage: import("@playwright/test").Page | null = null;
  const diagnosticEvents: unknown[] = [];
  try {
    const started = await test.step("Start the packaged runtime", () =>
      startPackagedServe(root, {
        PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(
          "pstdio-home",
          "pstdio-artifacts",
          "pstdio-session-browser",
          "pstdio-terminal",
        ),
      }));
    child = started.child;
    phase("runtime ready; create project");
    const folder = join(root, "project");
    mkdirSync(folder);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "empty-panels" }, folder)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    phase("project created; launch browser");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    diagnosticPage = page;
    page.on("console", (message) =>
      diagnosticEvents.push({ at: Date.now(), kind: "console", type: message.type(), text: message.text() }),
    );
    page.on("pageerror", (error) =>
      diagnosticEvents.push({ at: Date.now(), kind: "pageerror", message: error.message, stack: error.stack }),
    );
    page.on("request", (request) =>
      diagnosticEvents.push({ at: Date.now(), kind: "request", path: new URL(request.url()).pathname }),
    );
    page.on("requestfailed", (request) =>
      diagnosticEvents.push({
        at: Date.now(),
        kind: "requestfailed",
        path: new URL(request.url()).pathname,
        failure: request.failure(),
      }),
    );
    page.on("response", (response) =>
      diagnosticEvents.push({
        at: Date.now(),
        kind: "response",
        path: new URL(response.url()).pathname,
        status: response.status(),
      }),
    );
    await page.addInitScript(() => {
      const state = window as unknown as { __ps136Input: unknown[] };
      state.__ps136Input = [];
      const lifetime = window as unknown as { __ps136Lifecycle: unknown[] };
      lifetime.__ps136Lifecycle = [];
      const identities = new WeakMap<Element, number>();
      let nextIdentity = 0;
      let previous = "";
      const observe = () => {
        const headers = [...document.querySelectorAll("[data-workbench-panel-header]")].map((element) => {
          if (!identities.has(element)) identities.set(element, ++nextIdentity);
          return {
            identity: identities.get(element),
            region: element.getAttribute("data-workbench-panel-header"),
            actions: element.getAttribute("data-ps136-position-actions"),
            focused: document.activeElement === element,
          };
        });
        const current = JSON.stringify(headers);
        if (current === previous) return;
        previous = current;
        lifetime.__ps136Lifecycle.push({
          at: Date.now(),
          headers,
          active: document.activeElement?.outerHTML?.slice(0, 512),
        });
        if (lifetime.__ps136Lifecycle.length > 512) lifetime.__ps136Lifecycle.shift();
      };
      new MutationObserver(observe).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-ps136-position-actions", "data-workbench-panel-header"],
      });
      document.addEventListener("focusin", observe);
      document.addEventListener("focusout", observe);

      const describe = (value: EventTarget | null) =>
        value instanceof Element
          ? {
              tag: value.tagName,
              label: value.getAttribute("aria-label"),
              role: value.getAttribute("role"),
              panel: value.getAttribute("data-workbench-panel-header"),
              text: value.textContent?.slice(0, 120),
            }
          : null;
      for (const type of ["keydown", "focusin", "focusout", "contextmenu"])
        document.addEventListener(type, (event) => {
          state.__ps136Input.push({
            at: Date.now(),
            type,
            key: event instanceof KeyboardEvent ? event.key : null,
            defaultPrevented: event.defaultPrevented,
            target: describe(event.target),
            active: describe(document.activeElement),
          });
        });
    });
    phase("browser ready; sign in");
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, started.descriptor);
    phase("signed in; open project");
    await page.goto(`${started.baseUrl}/projects/${project.id}/`);
    await expect(homeFrame(page).getByText("Project home", { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-workbench-panel="main"]').getByLabel("Available tabs", { exact: true }),
    ).toHaveCount(0);
    await verifyPageHeaders(page);
    phase("project ready; check panel additions");
    await test.step("Add tools while preserving the other empty panel", () => verifyEmptyPanelAddition(page));
    phase("panel additions checked");
    await page.getByRole("option", { name: "Artifacts", exact: true }).click();
    await page
      .locator('[data-workbench-panel="main"]')
      .getByRole("tab", { name: "Artifacts", exact: true })
      .getByRole("button", { name: "Close Artifacts", exact: true })
      .click();
    await test.step("Place panels and cancel from the grab point", () => verifyPanelInsertionTargets(page));
  } catch (error) {
    const diagnosticRoot = "test-results/panel-menu-dom";
    mkdirSync(diagnosticRoot, { recursive: true });
    try {
      writeFileSync(`${diagnosticRoot}/events.json`, JSON.stringify(diagnosticEvents, null, 2));
      if (diagnosticPage && !diagnosticPage.isClosed()) {
        writeFileSync(`${diagnosticRoot}/page.html`, await diagnosticPage.content());
        writeFileSync(
          `${diagnosticRoot}/state.json`,
          JSON.stringify(
            await diagnosticPage.evaluate(() => ({
              url: location.origin + location.pathname,
              active: document.activeElement?.outerHTML,
              input: (window as unknown as { __ps136Input?: unknown[] }).__ps136Input,
              headers: [...document.querySelectorAll("[data-workbench-panel-header]")].map(
                (element) => element.outerHTML,
              ),
              menus: [...document.querySelectorAll('[role="menu"],[role="menuitem"]')].map(
                (element) => element.outerHTML,
              ),
            })),
            null,
            2,
          ),
        );
        await diagnosticPage.screenshot({ path: `${diagnosticRoot}/page.png`, fullPage: true, timeout: 5000 });
      }
    } catch (captureError) {
      console.log("PS136 diagnostic capture failed", String(captureError));
    }
    throw error;
  } finally {
    try {
      const diagnosticRoot = "test-results/panel-menu-lifecycle";
      mkdirSync(diagnosticRoot, { recursive: true });
      writeFileSync(`${diagnosticRoot}/events.json`, JSON.stringify(diagnosticEvents, null, 2));
      if (diagnosticPage && !diagnosticPage.isClosed()) {
        writeFileSync(
          `${diagnosticRoot}/state.json`,
          JSON.stringify(
            await diagnosticPage.evaluate(() => ({
              active: document.activeElement?.outerHTML,
              input: (window as unknown as { __ps136Input?: unknown[] }).__ps136Input,
              lifecycle: (window as unknown as { __ps136Lifecycle?: unknown[] }).__ps136Lifecycle,
              headers: [...document.querySelectorAll("[data-workbench-panel-header]")].map(
                (element) => element.outerHTML,
              ),
            })),
            null,
            2,
          ),
        );
      }
    } catch (captureError) {
      console.log("PS136 final diagnostic capture failed", String(captureError));
    }
    phase("cleanup");
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
