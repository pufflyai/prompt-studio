import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: timeline controls must remain reachable and keyframe edits must preserve focus and authored neighbours.
test("scrub, move, add and delete animation keys through the shared timeline", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/keyframe-timeline/keyframe-timeline.canvas.tsx#Animation",
  );
  const ruler = preview.getByRole("slider", { name: "Timeline playhead" });
  await ruler.focus();
  await ruler.press("Home");
  await ruler.press("ArrowRight");
  await expect(ruler).toHaveAttribute("aria-valuenow", "0.04");
  await preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true }).click();
  const timeField = preview.getByRole("spinbutton", { name: "Keyframe time", exact: true });
  await timeField.fill("0");
  await timeField.press("Tab");
  await expect(timeField).toHaveValue("1");
  await expect(preview.getByRole("alert")).toContainText("already occupies");
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(ruler).toHaveAttribute("aria-valuenow", "0");
  const first = preview.getByRole("button", { name: "Opacity keyframe 0:00:00", exact: true });
  await first.click();
  await first.press("ArrowRight");
  const moved = preview.getByRole("button", { name: "Opacity keyframe 0:00:01", exact: true });
  await expect(moved).toBeFocused();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true })).toBeVisible();
  const bounds = await moved.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 40, bounds!.y + bounds!.height / 2);
  await page.mouse.up();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:00:01", exact: true })).toHaveCount(0);
  // Select through the live tree rather than assuming a drag distance maps to one CSS pixel per frame.
  const active = preview
    .locator('button[aria-pressed="true"]')
    .filter({ has: preview.locator("span") })
    .first();
  await active.press("Delete");
  await expect(preview.getByRole("button", { name: "Opacity", exact: true })).toBeFocused();
  await ruler.focus();
  await ruler.press("Home");
  await ruler.press("ArrowRight");
  await preview.getByRole("button", { name: "Add keyframe", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Opacity keyframe 0:00:01", exact: true })).toBeVisible();
  const top = preview.getByRole("button", { name: "Top keyframe 0:00:06", exact: true });
  await top.click();
  await timeField.focus();
  await timeField.press("Tab");
  await expect(timeField).toHaveValue("0.25");
  const valueField = preview.getByRole("spinbutton", { name: "Keyframe value", exact: true });
  await valueField.fill("12");
  await valueField.press("Tab");
  await preview.getByRole("button", { name: "Opacity keyframe 0:01:00", exact: true }).click();
  await top.click();
  await expect(timeField).toHaveValue("0.25");
  await expect(valueField).toHaveValue("12");
  await preview.getByRole("button", { name: /Bullet 2/ }).click();
  await expect(preview.getByRole("button", { name: "Opacity", exact: true })).toHaveCount(0);
});
