import { expect, type Page, test } from "@playwright/test";

const projectId = (page: Page) => new URL(page.url()).pathname.split("/")[2];
const openExample = async (page: Page, name: string, resource?: string) => {
  const query = resource ? `?resource=${encodeURIComponent(`pstdio://extension-resource/${resource}`)}` : "";
  await page.goto(
    `/projects/${projectId(page)}/extensions/pstdio.extension-lab/${name}${resource ? "/resource" : ""}${query}`,
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", `pstdio.extension-lab.theme.${name}`);
};
const view = (page: Page, title: string) => page.frameLocator(`iframe[title="${title}"]`);
const hideAndReopen = async (page: Page, panel: "Side" | "Secondary", title: string) => {
  const frame = page.locator(`iframe[title="${title}"]`);
  const original = await frame.elementHandle();
  const url = page.url();
  await page.getByRole("button", { name: `Hide ${panel} Panel`, exact: true }).click();
  await expect(frame).toBeHidden();
  await page.getByRole("button", { name: `Show ${panel} Panel`, exact: true }).click();
  await expect(frame).toBeVisible();
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page).toHaveURL(url);
};
const floatAndReattach = async (page: Page) => {
  await page.getByRole("button", { name: "Float Side Panel", exact: true }).click();
  await expect(page.getByTestId("workbench-side-panel-floating")).toBeVisible();
  await page
    .locator('[data-workbench-region="nav"]')
    .getByRole("button", { name: "Hide Side Panel", exact: true })
    .click();
  await expect(page.getByTestId("workbench-side-panel-floating")).toHaveCount(0);
  await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
  await expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible();
};
const waitForExampleSave = (page: Page, name: string, content: string) =>
  page.waitForResponse(
    (response) =>
      response.url().includes("pstdio.extension-lab.command.state.update/execute") &&
      (response.request().postData()?.includes(JSON.stringify(name)) ?? false) &&
      (response.request().postData()?.includes(content) ?? false) &&
      response.ok(),
  );
const editDocument = async (page: Page, content: string) => {
  const saved = waitForExampleSave(page, "scribble", content);
  await view(page, "Document").locator('[contenteditable="true"]').first().fill(content);
  await saved;
  await expect(view(page, "Document").getByText("Saved locally", { exact: true })).toBeVisible();
};

test.beforeEach(async ({ page, request }) => {
  const response = await request.post(`http://localhost:${process.env.E2E_API_PORT ?? "3200"}/v1/projects`, {
    data: { name: "Public showcases" },
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.addInitScript((id: string) => {
    if (window.top !== window) return;
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("theme-preference", "pstdio-dark");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);
});

test("Scribble saves edits and creates documents", async ({ page }) => {
  await openExample(page, "scribble", "scribble.document/north-star");
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await expect(sidenav.locator('iframe[title="Pages"]')).toBeVisible();
  await expect(sidenav.getByRole("option", { name: "Sessions", exact: true })).toHaveCount(0);
  const pages = view(page, "Pages");
  const editor = () => view(page, "Document").locator('[contenteditable="true"]').first();
  await expect(editor()).toContainText("Why now");
  await editDocument(page, "A saved Scribble note");
  await pages.getByRole("button", { name: "Field notes", exact: true }).click();
  await expect(editor()).toContainText("Patterns");
  await pages.getByRole("button", { name: "North star", exact: true }).click();
  await expect(editor()).toContainText("A saved Scribble note");
  await page.reload();
  await expect(editor()).toContainText("A saved Scribble note");
  await pages.getByRole("button", { name: "New page", exact: true }).click();
  await expect(pages.getByRole("button", { name: "Untitled page", exact: true })).toBeVisible();
  await expect(view(page, "Document").getByText("Untitled page", { exact: true }).last()).toBeVisible();
  await expect(editor()).toBeEmpty();
  await editDocument(page, "A new document");
  await pages.getByRole("button", { name: "Field notes", exact: true }).click();
  await expect(editor()).toContainText("Patterns");
  await pages.getByRole("button", { name: "Untitled page", exact: true }).click();
  await expect(editor()).toContainText("A new document");
});

test("Boombox retains its player across pages and disposes it when its extension is disabled", async ({
  page,
  request,
}) => {
  await openExample(page, "boombox");
  await expect(page.locator('[data-workbench-region="sidenav"]')).toHaveCount(0);
  await expect(view(page, "Player").getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  const playerFrame = await page.locator('iframe[title="Player"]').elementHandle();
  const homeUrl = page.url();
  await view(page, "Lazy Sunday").getByRole("button", { name: "Play Paper Moon by Mira Vale" }).click();
  await expect(page).toHaveURL(/boombox\/resource\?resource=/);
  await expect(view(page, "Player").getByText("Paper Moon", { exact: true })).toBeVisible();
  expect(await playerFrame!.evaluate((frame) => frame.isConnected)).toBe(true);
  await view(page, "Player").getByRole("button", { name: "Pause", exact: true }).click();
  await expect(view(page, "Player").getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await hideAndReopen(page, "Secondary", "Player");
  await expect(view(page, "Player").getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(homeUrl);
  expect(await playerFrame!.evaluate((frame) => frame.isConnected)).toBe(true);
  await expect(view(page, "Player").getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await page.goForward();
  await expect(view(page, "Player").getByText("Paper Moon", { exact: true })).toBeVisible();
  expect(await playerFrame!.evaluate((frame) => frame.isConnected)).toBe(true);
  await view(page, "Player").getByRole("button", { name: "Next track" }).click();
  await expect(view(page, "Player").getByText("Afterimage", { exact: true })).toBeVisible();
  await view(page, "Library").getByRole("button", { name: "Liked songs", exact: true }).click();
  await expect(view(page, "Lazy Sunday").getByRole("button", { name: "Play Paper Moon by Mira Vale" })).toBeVisible();
  await expect(view(page, "Lazy Sunday").getByRole("button", { name: "Play Soft Focus by Low Island" })).toHaveCount(0);
  const extensionsUrl = `http://localhost:${process.env.E2E_API_PORT ?? "3200"}/v1/projects/${projectId(page)}/extensions`;
  const listed = await request.get(extensionsUrl);
  expect(listed.ok()).toBe(true);
  const { extensions } = await listed.json();
  const owner = extensions.find(
    (extension: { extensionId: string }) => extension.extensionId === "pstdio.extension-lab",
  );
  expect(owner).toBeDefined();
  const disabled = await request.patch(`${extensionsUrl}/${owner.id}`, { data: { enabled: false } });
  expect(disabled.ok()).toBe(true);
  await expect(page.locator('iframe[title="Player"]')).toHaveCount(0);
  expect(await playerFrame!.evaluate((frame) => frame.isConnected)).toBe(false);
});

test("Zipline opens its inspector and persists a status change", async ({ page }) => {
  await openExample(page, "zipline");
  await page.getByText("ZIP-142", { exact: true }).click();
  const inspector = view(page, "Issue");
  await expect(inspector.getByText("ZIP-142", { exact: true })).toBeVisible();
  await hideAndReopen(page, "Side", "Issue");
  await floatAndReattach(page);
  const saved = waitForExampleSave(page, "zipline", "Done");
  await inspector.getByRole("button", { name: "Change status from In progress to Done", exact: true }).click();
  await expect(
    inspector.getByRole("button", { name: "Change status from Done to Backlog", exact: true }),
  ).toBeVisible();
  await saved;
  await page.reload();
  await expect(
    inspector.getByRole("button", { name: "Change status from Done to Backlog", exact: true }),
  ).toBeVisible();
});

test("Pigeon sends a local message and keeps it in Sent", async ({ page }) => {
  await openExample(page, "pigeon");
  const folders = view(page, "Folders");
  const inbox = view(page, "Inbox");
  await expect(folders.getByRole("button", { name: "Inbox 2", exact: true })).toBeVisible();
  await inbox.getByText("Launch notes for Friday", { exact: true }).click();
  await hideAndReopen(page, "Side", "Message");
  await floatAndReattach(page);
  await expect(folders.getByRole("button", { name: "Inbox 1", exact: true })).toBeVisible();
  await folders.getByRole("button", { name: "Compose", exact: true }).click();
  await inbox.getByRole("textbox", { name: "To", exact: true }).fill("alex@example.com");
  await inbox.getByRole("textbox", { name: "Subject", exact: true }).fill("Showcase review");
  await inbox.getByRole("textbox", { name: "Message body", exact: true }).fill("The examples are ready.");
  const saved = waitForExampleSave(page, "pigeon", "Showcase review");
  await inbox.getByRole("button", { name: "Send", exact: true }).click();
  await folders.getByRole("button", { name: "Sent", exact: true }).click();
  await expect(inbox.getByText("Showcase review", { exact: true })).toBeVisible();
  await saved;
  await page.reload();
  await expect(inbox.getByText("Showcase review", { exact: true })).toBeVisible();
  await inbox.getByText("Showcase review", { exact: true }).click();
  await expect(view(page, "Message").getByText("The examples are ready.", { exact: true })).toBeVisible();
  const messageUrl = page.url();
  await view(page, "Message").getByRole("button", { name: "Close message", exact: true }).click();
  await expect(page.locator('iframe[title="Message"]')).toHaveCount(0);
  await expect(page).toHaveURL(messageUrl);
  await expect(inbox.getByText("Showcase review", { exact: true })).toBeVisible();
});

test("Kiln docks the inspector and persists object changes", async ({ page }) => {
  await openExample(page, "kiln", "kiln.object/cube");
  const inspector = view(page, "Scene and properties");
  await expect(view(page, "3D viewport").locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Float Side Panel", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator('[data-workbench-panel-header="secondary"]')).toHaveCount(0);
  await hideAndReopen(page, "Side", "Scene and properties");
  await hideAndReopen(page, "Secondary", "Timeline");
  await inspector.getByRole("button", { name: "Hide Cube", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "Show Cube", exact: true })).toBeVisible();
  const timeline = view(page, "Timeline");
  await timeline.getByRole("button", { name: "First frame", exact: true }).click();
  await expect(timeline.getByRole("slider", { name: "Animation frame" })).toHaveValue("1");
  await timeline.getByRole("button", { name: "Play animation", exact: true }).click();
  await expect(timeline.getByRole("slider", { name: "Animation frame" })).not.toHaveValue("1");
  await timeline.getByRole("button", { name: "Pause animation", exact: true }).click();
  const saved = waitForExampleSave(page, "kiln", "2.5");
  await inspector.getByRole("spinbutton", { name: "Cube position X", exact: true }).fill("2.5");
  await saved;
  await page.reload();
  await expect(inspector.getByRole("spinbutton", { name: "Cube position X", exact: true })).toHaveValue("2.5");
  await expect(inspector.getByRole("button", { name: "Show Cube", exact: true })).toBeVisible();
});

test("mode defaults restore the global theme on leaving", async ({ page }) => {
  await openExample(page, "pigeon");
  await page.evaluate(() => localStorage.setItem("theme-preference:pstdio.extension-lab.mode.pigeon", "pstdio-light"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pstdio-light");
  await view(page, "Pigeon").getByRole("button", { name: "Back to project", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pstdio-dark");
  expect(await page.evaluate(() => localStorage.getItem("theme-preference"))).toBe("pstdio-dark");
});

test("Lab faulty keeps the isolated error example", async ({ page }) => {
  await page.goto(`/projects/${projectId(page)}/extensions/pstdio.extension-lab/lab-faulty`);
  await expect(page.getByText(/this module fails on purpose/i).first()).toBeVisible();
});
