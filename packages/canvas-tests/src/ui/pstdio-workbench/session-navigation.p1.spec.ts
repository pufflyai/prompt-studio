import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const source = "packages/pstdio-workbench/src/react/region/session-navigation.canvas.tsx#Interactive";
// Critical: empty navigation and single-view pages must remain usable drag destinations.
test("a header entry moves into an empty body and opens a side tab by dragging", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  const row = preview.getByRole("option", { name: "Sessions", exact: true });
  await expect(row).toBeVisible();
  const start = (await row.boundingBox())!;
  await page.mouse.move(start.x + 30, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 30, start.y + start.height + 15, { steps: 3 });
  const body = preview.locator("[data-tree-list-empty-drop-zone]");
  await expect(body).toBeVisible();
  const end = (await body.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(
    preview.getByRole("listbox").nth(1).getByRole("option", { name: "Sessions", exact: true }),
  ).toBeVisible();

  const side = preview.locator('[data-workbench-panel="side"]');
  await side.getByRole("button", { name: "Close Review session", exact: true }).click();
  const moved = (await row.boundingBox())!;
  await page.mouse.move(moved.x + 30, moved.y + moved.height / 2);
  await page.mouse.down();
  const header = preview.locator('[data-workbench-panel-header="side"]');
  await expect(header).toBeVisible();
  const target = (await header.boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(side.locator('[data-testid="session-content"]:visible')).toHaveText("Review session");
});

test("dropping a side conversation onto Main opens its session page", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  const side = preview.locator('[data-workbench-panel="side"]');
  const tab = side.getByRole("tab", { name: /Review session/ });
  const from = (await tab.boundingBox())!;
  await page.mouse.move(from.x + 25, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x - 15, from.y + from.height / 2, { steps: 4 });
  const mainDrop = preview.locator('[data-workbench-tab-drop="main"]');
  await expect(mainDrop).toBeVisible();
  const target = (await mainDrop.boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(preview.locator('[data-workbench-panel="main"]').getByTestId("session-content")).toHaveText(
    "Review session",
  );
  await expect(tab).toHaveCount(0);
});

// Critical: a menu opened before Option must show hints, and Create works away from Sessions.
test("an open menu updates shortcut hints and New session works from Notes", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  await preview.getByRole("option", { name: "Sessions", exact: true }).click({ button: "right" });
  const item = preview.getByRole("menuitem", { name: "New session" });
  await expect(item).toBeVisible();
  await page.keyboard.down("Alt");
  await expect(item.locator("kbd")).not.toHaveCount(0);
  await page.keyboard.up("Alt");
  await page.keyboard.press("Escape");
  await preview.getByRole("option", { name: "Notes", exact: true }).click();
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("c");
  await page.keyboard.press("s");
  await expect(preview.locator('[data-workbench-panel="main"]').getByTestId("session-content")).toHaveText(
    "New session",
  );
});

// Critical: a retained editor must not leave formatting controls over another page.
test("a retained editor hides its floating toolbar when navigating away", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  await preview.getByRole("option", { name: "Notes", exact: true }).click();
  const editor = preview.locator('[contenteditable="true"]');
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await expect(preview.getByRole("button", { name: "Bold", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Navigate back", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(preview.getByRole("button", { name: "Bold", exact: true })).toBeHidden();
});

// Critical: dropping a resource into a tabless collection must open its page in Main.
test("page and panel resource rows dropped onto tabless Main open their resource page", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  for (const label of ["Linked session", "Sessions"]) {
    await preview.getByRole("option", { name: "Tickets", exact: true }).click();
    const main = preview.locator('[data-workbench-panel="main"]');
    await expect(main).toContainText("Ticket collection");
    const row = preview.getByRole("option", { name: label, exact: true });
    const from = (await row.boundingBox())!;
    const to = (await main.boundingBox())!;
    await page.mouse.move(from.x + 25, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(main.getByTestId("session-content")).toHaveText("Review session");
    await expect(
      preview.locator('[data-workbench-panel="side"]').getByRole("tab", { name: "Review session", exact: true }),
    ).toHaveCount(0);
  }
});

// Critical: a tab strip must accept static and single-resource page entries without invalid pin intents.
test("Main tab headers open static and single-resource pages from navigation", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  for (const label of ["Notes", "Sessions"]) {
    await preview.getByRole("option", { name: "Files", exact: true }).click();
    const header = preview.locator('[data-workbench-panel-header="main"]');
    await expect(header).toBeVisible();
    const from = (await preview.getByRole("option", { name: label, exact: true }).boundingBox())!;
    const to = (await header.boundingBox())!;
    await page.mouse.move(from.x + 25, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    const main = preview.locator('[data-workbench-panel="main"]');
    if (label === "Notes") await expect(main.locator('[contenteditable="true"]')).toBeVisible();
    else await expect(main.getByTestId("session-content")).toHaveText("Review session");
  }
});

// Critical: singleton collection tabs must not become stranded outside their owning page.
test("dropping the Tickets collection tab onto Main opens its page", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  const tab = preview.locator('[data-workbench-panel="side"]').getByRole("tab", { name: /Tickets/ });
  const from = (await tab.boundingBox())!;
  await page.mouse.move(from.x + 25, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x - 15, from.y + from.height / 2, { steps: 4 });
  const mainDrop = preview.locator('[data-workbench-tab-drop="main"]');
  await expect(mainDrop).toBeVisible();
  const target = (await mainDrop.boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(preview.locator('[data-workbench-panel="main"]')).toContainText("Ticket collection");
  await expect(tab).toHaveCount(0);
});

// Critical: the session's resources must remain reachable through its own panel menu.
test("session resources use their panel menu and toggle from its opener", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  const activity = preview
    .getByRole("option", { name: "Linked session", exact: true })
    .locator('div[aria-hidden="true"]');
  await expect(activity).toHaveCount(1);
  await preview
    .locator('[data-workbench-panel="side"]')
    .getByRole("tab", { name: "Review session", exact: true })
    .click();
  await expect(activity).toHaveCount(0);
  const opener = preview.getByRole("button", { name: "Open Side right menu", exact: true });
  await opener.click();
  const menu = preview.locator('[data-workbench-panel-menu-controls="side-right-menu"]');
  await expect(menu.getByRole("option", { name: "Relationship test", exact: true })).toBeVisible();
  await test.info().attach("Session resources panel menu", { body: await page.screenshot(), contentType: "image/png" });
  await opener.click();
  await expect(menu).not.toBeVisible();
  await opener.click();
  await expect(menu.getByRole("option", { name: "Relationship test", exact: true })).toBeVisible();
  await opener.click();
  await preview
    .locator('[data-workbench-panel="side"]')
    .getByRole("tab", { name: "Another session", exact: true })
    .click();
  await expect(opener).toHaveCount(0);
  await expect(activity).toHaveCount(1);
  await preview
    .locator('[data-workbench-panel="side"]')
    .getByRole("tab", { name: "Review session", exact: true })
    .click();
  await opener.click();
  await menu.getByRole("option", { name: "Relationship test", exact: true }).click();
  await expect(preview.locator('[data-workbench-panel="main"]')).toContainText("Ticket collection");
});

// Critical: adding a resource menu must leave ordinary message submission reachable.
test("the Side launcher leaves the session composer operable beside its resources", async ({ page }) => {
  const preview = await openCanvasPreview(page, source.replace("#Interactive", "#ComposerWithResources"));
  const main = preview.locator('[data-workbench-panel="main"]');
  await expect(main.getByRole("option", { name: "Relationship test", exact: true })).toBeVisible();
  await main.getByTestId("send-message-button").click();
  await expect(main.getByRole("status", { name: "Submitted follow-up" })).toHaveText("Check related resources");
  const before = (await main.boundingBox())!;
  await preview.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  const floating = preview.getByTestId("workbench-side-panel-floating");
  await expect(floating).toBeVisible();
  expect((await main.boundingBox())!.height).toBe(before.height);
  await floating.getByRole("tab", { name: "Review session", exact: true }).click();
  await floating.getByRole("button", { name: "Open Side right menu", exact: true }).click();
  await preview
    .locator('[data-workbench-panel-menu-controls="side-right-menu"]')
    .getByRole("option", { name: "Relationship test", exact: true })
    .click();
  await expect(main).toContainText("Ticket collection");
  await floating.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
  await expect(preview.getByTestId("workbench-side-panel-attached")).toBeVisible();
  await expect.poll(async () => (await main.boundingBox())!.height).toBe(before.height);
});

// Critical: compound resource destinations must remain usable from either Main layout.
test("notes dropped onto Main open their collection and note", async ({ page }) => {
  const preview = await openCanvasPreview(page, source);
  for (const destination of ["Tickets", "Files"]) {
    await preview.getByRole("option", { name: destination, exact: true }).click();
    const row = preview.getByRole("option", { name: "Sample note", exact: true });
    const main = preview.locator('[data-workbench-panel="main"]');
    const from = (await row.boundingBox())!;
    const to = (await main.boundingBox())!;
    await page.mouse.move(from.x + 25, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(main.locator('[contenteditable="true"]')).toBeVisible();
    await expect(main.getByRole("tab", { name: "Sample note", exact: true })).toBeVisible();
  }
});
