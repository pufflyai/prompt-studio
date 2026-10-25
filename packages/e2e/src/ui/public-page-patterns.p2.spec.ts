import { expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";

const projectId = (page: Page) => new URL(page.url()).pathname.split("/")[2];
const openExample = async (page: Page, name: string, resource?: string) => {
  const query = resource ? `?resource=${encodeURIComponent(`pstdio://extension-resource/${resource}`)}` : "";
  await page.goto(
    `/projects/${projectId(page)}/extensions/pstdio.extension-lab/${name}${resource ? "/resource" : ""}${query}`,
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", `pstdio.extension-lab.theme.${name}`);
};
const view = (page: Page, title: string) => page.frameLocator(`iframe[title="${title}"]:visible`);
const hideAndReopen = async (page: Page, panel: "Side" | "Bottom", title: string) => {
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
    .getByRole("group", { name: "Panel controls" })
    .getByRole("button", { name: "Hide Side Panel", exact: true })
    .click();
  await expect(page.getByTestId("workbench-side-panel-floating")).toBeHidden();
  await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
  await expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible();
};
const waitForExampleSave = (page: Page, name: string, field: string, content: string) =>
  page.waitForResponse((response) => {
    if (!response.url().includes("pstdio.extension-lab.command.state.update/execute") || !response.ok()) return false;
    const { params } = response.request().postDataJSON() as {
      params: { name: string; changes: { path: string[]; value: unknown }[] };
    };
    return (
      params.name === name &&
      params.changes.some((change) => change.path[0] === field && JSON.stringify(change.value).includes(content))
    );
  });
const editDocument = async (page: Page, content: string) => {
  const saved = waitForExampleSave(page, "scribble", "contentById", content);
  await view(page, "Document").locator('[contenteditable="true"]').first().fill(content);
  await saved;
  await expect(view(page, "Document").locator('[contenteditable="true"]').first()).toContainText(content);
};

test.beforeEach(async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Public showcases" }),
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
  await expect(sidenav.getByRole("option", { name: "North star", exact: true })).toBeVisible();
  await expect(sidenav.getByRole("option", { name: "Sessions", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Bottom Panel/ })).toHaveCount(0);
  await expect(page.locator('[data-workbench-region="status"] iframe[title="Sync status"]')).toBeVisible();
  const pages = sidenav;
  const editor = () => view(page, "Document").locator('[contenteditable="true"]').first();
  await expect(editor()).toContainText("Why now");
  await editDocument(page, "A saved Scribble note");
  await pages.getByRole("option", { name: "Field notes", exact: true }).click();
  await expect(editor()).toContainText("Patterns");
  await pages.getByRole("option", { name: "North star", exact: true }).click();
  await expect(editor()).toContainText("A saved Scribble note");
  await page.reload();
  await expect(editor()).toContainText("A saved Scribble note");
  await pages.getByRole("option", { name: "New page", exact: true }).click();
  await expect(pages.getByRole("option", { name: "Untitled page", exact: true })).toHaveCount(0);
  await expect(view(page, "Document").getByText("Untitled page", { exact: true }).last()).toBeVisible();
  await expect(editor()).toBeEmpty();
  await editor().fill("A new document");
  await view(page, "Document").getByRole("button", { name: "Save page", exact: true }).click();
  await expect(pages.getByRole("option", { name: "Untitled page", exact: true })).toBeVisible();
  await pages.getByRole("option", { name: "Field notes", exact: true }).click();
  await expect(editor()).toContainText("Patterns");
  await pages.getByRole("option", { name: "Untitled page", exact: true }).click();
  await expect(editor()).toContainText("A new document");
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  await expect(page.getByTestId("workbench-side-panel-floating")).toBeVisible();
  await expect(
    page.getByTestId("workbench-side-panel-floating").locator("[data-testid=content-editable][contenteditable=true]"),
  ).toBeVisible();
});

test("Boombox retains its player across selections and disposes it when its extension is disabled", async ({
  page,
  request,
}) => {
  await openExample(page, "boombox");
  await expect(page.getByRole("button", { name: "Enter Main fullscreen", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-workbench-region="sidenav"]')).toBeHidden();
  await expect(view(page, "Player").getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  const playerFrame = await page.locator('iframe[title="Player"]').elementHandle();
  const homePath = new URL(page.url()).pathname;
  const history = await page.evaluate(() => window.history.length);
  await view(page, "Lazy Sunday").getByRole("button", { name: "Play Paper Moon by Mira Vale" }).click();
  expect(new URL(page.url()).pathname).toBe(homePath);
  await expect(view(page, "Player").getByText("Paper Moon", { exact: true })).toBeVisible();
  expect(await playerFrame!.evaluate((frame) => frame.isConnected)).toBe(true);
  await view(page, "Player").getByRole("button", { name: "Pause", exact: true }).click();
  await expect(view(page, "Player").getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.locator('[data-workbench-region="side"] iframe[title="Queue"]')).toBeVisible();
  await expect(view(page, "Queue").getByText("Playing now", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Hide (Side|Bottom) Panel/ })).toHaveCount(0);
  await expect(view(page, "Player").getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  await view(page, "Player").getByRole("button", { name: "Next track" }).click();
  await expect(view(page, "Player").getByText("Afterimage", { exact: true })).toBeVisible();
  await view(page, "Library").getByRole("button", { name: "Liked songs", exact: true }).click();
  await expect(view(page, "Lazy Sunday").getByRole("button", { name: "Play Paper Moon by Mira Vale" })).toBeVisible();
  await expect(view(page, "Lazy Sunday").getByRole("button", { name: "Play Soft Focus by Low Island" })).toHaveCount(0);
  const extensionsUrl = `${apiBase}/v1/projects/${projectId(page)}/extensions`;
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
  const saved = waitForExampleSave(page, "zipline", "statuses", "Done");
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
  await expect(page.getByRole("button", { name: /Bottom Panel/ })).toHaveCount(0);
  await expect(folders.getByRole("button", { name: "Inbox 2", exact: true })).toBeVisible();
  await inbox.getByText("Launch notes for Friday", { exact: true }).click();
  await hideAndReopen(page, "Side", "Message");
  await floatAndReattach(page);
  await expect(folders.getByRole("button", { name: "Inbox 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  const floating = page.getByTestId("workbench-side-panel-floating");
  const messageTab = floating.getByRole("tab", { name: "Message", exact: true });
  await expect(messageTab).toBeVisible();
  await messageTab.click();
  await expect(view(page, "Message").getByText("Launch notes for Friday", { exact: true })).toBeVisible();
  await folders.getByRole("button", { name: "Compose", exact: true }).click();
  await inbox.getByRole("textbox", { name: "To", exact: true }).fill("alex@example.com");
  await inbox.getByRole("textbox", { name: "Subject", exact: true }).fill("Showcase review");
  await inbox.getByRole("textbox", { name: "Message body", exact: true }).fill("The examples are ready.");
  const saved = waitForExampleSave(page, "pigeon", "sent", "Showcase review");
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
  await expect(page.locator('iframe[title="Message"]:visible')).toHaveCount(0);
  await expect(page).toHaveURL(messageUrl);
  await expect(inbox.getByText("Showcase review", { exact: true })).toBeVisible();
});

test("Kiln docks the inspector and persists object changes", async ({ page }) => {
  await openExample(page, "kiln");
  const inspector = view(page, "Scene and properties");
  const gridToggle = view(page, "3D viewport").getByRole("button", { name: "Toggle viewport grid", exact: true });
  await gridToggle.click();
  await expect(gridToggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Float Side Panel", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-workbench-panel="main"]').getByRole("tab")).toHaveCount(0);
  const side = page.locator('[data-workbench-panel="side"]');
  await expect(side.locator('iframe[title="Scene and properties"]:visible')).toBeVisible();
  await expect(side.getByRole("tab")).toHaveCount(0);
  await expect(page.locator('[data-workbench-panel-header="secondary"]')).toBeHidden();
  await expect(page.getByRole("button", { name: /Hide (Side|Bottom) Panel/ })).toHaveCount(0);
  await inspector.getByRole("button", { name: "Hide Cube", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "Show Cube", exact: true })).toBeVisible();
  const timeline = view(page, "Timeline");
  await timeline.getByRole("button", { name: "First frame", exact: true }).click();
  await expect(timeline.getByRole("slider", { name: "Animation frame" })).toHaveValue("1");
  await timeline.getByRole("button", { name: "Play animation", exact: true }).click();
  await expect(timeline.getByRole("slider", { name: "Animation frame" })).not.toHaveValue("1");
  await timeline.getByRole("button", { name: "Pause animation", exact: true }).click();
  const saved = waitForExampleSave(page, "kiln", "objectStates", "2.5");
  await inspector.getByRole("spinbutton", { name: "Cube position X", exact: true }).fill("2.5");
  await saved;
  await page.reload();
  await inspector.getByRole("button", { name: "Show Cube", exact: true }).click();
  await expect(inspector.getByRole("spinbutton", { name: "Cube position X", exact: true })).toHaveValue("2.5");
  await expect(inspector.getByRole("button", { name: "Hide Cube", exact: true })).toBeVisible();
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
