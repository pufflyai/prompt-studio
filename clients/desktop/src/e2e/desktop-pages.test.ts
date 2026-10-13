import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";
import { waitForWorkbenchPage } from "./desktop-pages";

let browser: Browser;
let context: BrowserContext;
let lifecycle: Page;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser.close();
});
beforeEach(async () => {
  context = await browser.newContext();
  lifecycle = await context.newPage();
});
afterEach(async () => {
  await context.close();
});

test("workbench readiness reports lifecycle recovery before a new page arrives", async () => {
  await lifecycle.setContent("<section><h1>Prompt Studio needs attention</h1><p>Database startup failed</p></section>");
  const failure = await waitForWorkbenchPage(lifecycle, "http://127.0.0.1:1").catch((error: Error) => error);
  expect(failure).toMatchObject({ message: expect.stringContaining("Database startup failed") });
}, 1_000);

test("workbench readiness reports recovery while an existing page is still navigating", async () => {
  await context.newPage();
  await lifecycle.setContent("<section><h1>Prompt Studio needs attention</h1><p>Runtime stopped</p></section>");
  const failure = await waitForWorkbenchPage(lifecycle, "http://127.0.0.1:1").catch((error: Error) => error);
  expect(failure).toMatchObject({ message: expect.stringContaining("Runtime stopped") });
});

test("workbench readiness returns a newly opened page at the runtime origin", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response("Workbench", { headers: { "content-type": "text/html" } }),
  });
  try {
    const ready = waitForWorkbenchPage(lifecycle, server.url.origin);
    const workbench = await context.newPage();
    await workbench.goto(server.url.origin);
    expect(await ready).toBe(workbench);
  } finally {
    await server.stop(true);
  }
});
