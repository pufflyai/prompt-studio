import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a long nested navigation must not scroll its only return control out of reach.
test("the nested navigation return stays between the header and scrolling items", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/tree/tree-mode-return.canvas.tsx#Project",
  );
  const back = preview.getByRole("button", { name: "Back to project", exact: true });
  const tree = preview.getByRole("region", { name: "Navigation" });
  const scroll = tree.locator('[data-scope="scroll-area"][data-part="viewport"]');
  await expect(back).toBeVisible();
  const before = (await back.boundingBox())!;
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(back).toBeInViewport();
  await expect.poll(async () => (await back.boundingBox())!.y).toBeCloseTo(before.y, 0);
  await expect(preview.getByRole("group", { name: "Return navigation" })).toContainText("Back to project");
  await back.click();
  await expect(back).toBeHidden();
});
