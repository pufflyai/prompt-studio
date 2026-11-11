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
