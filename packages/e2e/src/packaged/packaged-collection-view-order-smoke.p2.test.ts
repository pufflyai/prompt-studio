import { test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import { WORKSPACES_COLLECTION_ID } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

const verifyOrder = async (page: Page, projectId: string, boardId: string) => {
  const phase = (name: string) => console.log(`Packaged view order: ${boardId}: ${name} (${Date.now()})`);
  const bar = page.getByTestId("collection-view-bar");
  const tabs = bar.getByRole("tab");
  const add = bar.getByRole("button", { name: "Add view", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(tabs).toHaveCount(2);
  await expect(add).toBeEnabled();
  await add.click();
  await expect(tabs).toHaveCount(3);
  await expect(add).toBeEnabled();
  const original = await tabs.allTextContents();
  phase("views created");
  const selected = tabs.nth(2);
  await expect(selected).toHaveAttribute("aria-selected", "true");
  const firstBounds = await tabs.first().boundingBox();
  const lastBounds = await tabs.last().boundingBox();
  if (!firstBounds || !lastBounds) throw new Error("Saved view tabs have no bounds");
  await page.mouse.move(firstBounds.x + firstBounds.width / 2, firstBounds.y + firstBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(lastBounds.x + lastBounds.width - 2, lastBounds.y + lastBounds.height / 2, { steps: 8 });
  await page.mouse.up();
  const reordered = [original[1]!, original[2]!, original[0]!];
  await expect(tabs).toHaveText(reordered);
  await expect(bar.getByRole("tab", { name: original[2], exact: true })).toHaveAttribute("aria-selected", "true");
  const path = `${new URL(page.url()).origin}/v1/projects/${projectId}/boards/${encodeURIComponent(boardId)}/views`;
  const readTitles = async () => {
    const result = await (await page.request.get(path)).json();
    return result.views.map((view: { title: string }) => view.title);
  };
  await expect.poll(readTitles).toEqual(reordered);
  phase("pointer order saved");
  await page.reload();
  await expect(tabs).toHaveText(reordered);
  const moved = bar.getByRole("tab", { name: original[0], exact: true });
  await moved.focus();
  await page.keyboard.press("Alt+ArrowLeft");
  const keyboardOrder = [original[1]!, original[0]!, original[2]!];
  await expect(tabs).toHaveText(keyboardOrder);
  await expect.poll(readTitles).toEqual(keyboardOrder);
  // A later agent/API reorder reaches the same tabs through live sync.
  const views = (await (await page.request.get(path)).json()).views as { id: string }[];
  const response = await page.request.put(`${path}/order`, {
    data: { viewIds: views.map((view) => view.id).reverse() },
  });
  expect(response.ok()).toBe(true);
  await expect(tabs).toHaveText([...keyboardOrder].reverse());
  phase("keyboard and API order saved");
};

setupPackagedSmokeTests();

test("packaged Kanban and data table view tabs save pointer and keyboard order", async () => {
  const startedAt = Date.now();
  const phase = (name: string) => console.log(`Packaged view order: ${name} (${Date.now() - startedAt}ms)`);
  const root = mkdtempSync(join(tmpdir(), "packaged-collection-view-order-"));
  let child: ChildProcess | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-planner") });
    child = runtime.child;
    phase("runtime ready");
    const folder = join(root, "project");
    mkdirSync(folder);
    const creatingProject = (async () => {
      const response = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Saved view order" }, folder)),
      });
      expect(response.status).toBe(201);
      const { id } = (await response.json()) as { id: string };
      phase("project created");
      return id;
    })();
    const openingPage = chromium.launch(PACKAGED_DASHBOARD_BROWSER).then((opened) => {
      browser = opened;
      return opened.newPage({ extraHTTPHeaders: runtimeAuthorization(runtime.descriptor) });
    });
    const [projectSetup, browserSetup] = await Promise.allSettled([creatingProject, openingPage]);
    if (projectSetup.status === "rejected") throw projectSetup.reason;
    if (browserSetup.status === "rejected") throw browserSetup.reason;
    const id = projectSetup.value;
    const page = browserSetup.value;
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, runtime.descriptor, `/projects/${id}/extensions/pstdio.pstdio-planner/tickets`);
    phase("browser signed in");
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    await verifyOrder(page, id, "pstdio.pstdio-planner.view.tickets");
    await page.goto(`${runtime.baseUrl}/projects/${id}/workspaces`);
    await verifyOrder(page, id, WORKSPACES_COLLECTION_ID);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
