import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { type Browser, type BrowserContext, chromium, type Page, expect as playwrightExpect } from "@playwright/test";
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

test("workbench readiness accepts a saved route restored before observation starts", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response("Workbench", { headers: { "content-type": "text/html" } }),
  });
  const workbench = await context.newPage();
  const savedUrl = new URL("/projects/saved/sessions", server.url).href;
  await workbench.goto(savedUrl);
  let readyPage: Page | undefined;
  const ready = waitForWorkbenchPage(lifecycle, server.url.origin).then((page) => {
    readyPage = page;
  });
  try {
    await playwrightExpect.poll(() => readyPage === workbench, { timeout: 1_000 }).toBe(true);
    expect(workbench.url()).toBe(savedUrl);
  } finally {
    await workbench.goto(server.url.origin);
    await ready;
    await server.stop(true);
  }
});

test("workbench readiness reports a new failure after the previous recovery element detaches", async () => {
  await lifecycle.setContent("<section><h1>Prompt Studio needs attention</h1><p>Previous failure</p></section>");
  const previous = await lifecycle.getByRole("heading", { name: "Prompt Studio needs attention" }).elementHandle();
  await lifecycle.evaluate(() => {
    document.querySelector("section")?.remove();
    const current = document.createElement("section");
    current.innerHTML = "<h1>Prompt Studio needs attention</h1><p>New startup failed</p>";
    document.body.append(current);
  });
  await previous!.waitForElementState("hidden");
  const failure = await waitForWorkbenchPage(lifecycle, "http://127.0.0.1:1").catch((error: unknown) => error);
  expect(failure).toMatchObject({ message: expect.stringContaining("New startup failed") });
});
