import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: command choices must remain selectable inside clipped forms and nested modal focus traps.
test("dialog choices retain their form, scrolling and nearest modal owner", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/overlays/searchable-menu.canvas.tsx#PortalledInsideDialog",
  );
  const dialog = preview.getByRole("dialog", { name: "Create workspace", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "main", exact: true }).click();
  await preview.getByRole("menu").press("End");
  const last = preview.getByRole("menuitemradio", { name: "feature/searchable-menu-17", exact: true });
  await expect(last).toBeInViewport();
  await last.click();
  await expect(dialog.getByRole("button", { name: "feature/searchable-menu-17", exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Known tag", exact: true }).click();
  await preview.getByRole("textbox", { name: "Search options…", exact: true }).fill("new,tag");
  await preview.getByText('Use "new,tag"', { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Known tag, new,tag", exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Review workspace", exact: true }).click();
  const review = preview.getByRole("dialog", { name: "Review workspace", exact: true });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "feature/searchable-menu-17", exact: true }).click();
  await preview.getByRole("menu").press("Home");
  await preview.getByRole("menuitemradio", { name: "main", exact: true }).click();
  await expect(review.getByRole("button", { name: "main", exact: true })).toBeVisible();
  await review.getByRole("button", { name: "Back to workspace", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Known tag, new,tag", exact: true })).toBeVisible();
});
