import { afterEach, describe, test } from "bun:test";
import { type Browser, chromium, type Page, expect as playwrightExpect } from "@playwright/test";

let server: Bun.Subprocess | undefined;
let browser: Browser | undefined;

const port = 65173;
const baseUrl = `http://127.0.0.1:${port}`;

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/smoke.html`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Timed out waiting for the dashboard workbench smoke server");
};

const startSmokeServer = async () => {
  server = Bun.spawn(["bun", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await waitForServer();
};

const createSmokePage = async () => {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("**/v1/sessions/session-1/conversation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        messages: [{ id: "message-1", role: "assistant", parts: [{ type: "text", text: "Smoke conversation" }] }],
      }),
    });
  });
  await page.route("**/v1/sessions/session-1/stream**", async (route) => {
    await route.fulfill({ contentType: "text/event-stream", body: "event: ready\ndata: {}\n\n" });
  });
  return page;
};

const openSmokeSurface = async (
  page: Page,
  surface: "openTicket" | "openWorkspace" | "openSession" | "openSettings",
) => {
  await page.evaluate((name) => window.__dashboardWorkbenchSmoke?.[name](), surface);
};

afterEach(async () => {
  await browser?.close();
  browser = undefined;
  server?.kill();
  server = undefined;
});

describe("dashboard workbench smoke", () => {
  test("starts Vite, renders workbench surfaces, and preserves session chat across panel modes", async () => {
    await startSmokeServer();
    const page = await createSmokePage();

    await page.goto(`${baseUrl}/smoke.html`);
    await page.locator("[data-dashboard-smoke-ready=true]").waitFor({ state: "attached" });

    await openSmokeSurface(page, "openTicket");
    await playwrightExpect(page.getByText("Dashboard workbench smoke ticket").first()).toBeVisible();

    await openSmokeSurface(page, "openWorkspace");
    await playwrightExpect(page.getByText("Smoke attempt workspace").first()).toBeVisible();

    await openSmokeSurface(page, "openSettings");
    await playwrightExpect(page.getByText("opencode").first()).toBeVisible();

    await openSmokeSurface(page, "openSession");
    await playwrightExpect(page.getByTestId("workbench-session-attached-panel")).toBeVisible();
    await playwrightExpect(page.getByText("Smoke conversation")).toBeVisible();

    const editor = page.locator('[contenteditable="true"]').last();
    await editor.fill("Preserve this draft");

    await page.getByLabel("Detach panel").click();
    await playwrightExpect(page.getByTestId("workbench-session-bubble")).toBeVisible();
    await playwrightExpect(editor).toContainText("Preserve this draft");

    await page.getByLabel("Attach panel").click();
    await playwrightExpect(page.getByTestId("workbench-session-attached-panel")).toBeVisible();
    await playwrightExpect(editor).toContainText("Preserve this draft");
  }, 30_000);
});
