import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: overlays from retained pages must not cover the destination or steal its keyboard input.
for (const label of ["Main", "Chrome", "Suspended"]) {
  test(`${label} overlays close on navigation and stay closed on return`, async ({ page }) => {
    const preview = await openCanvasPreview(
      page,
      "packages/pstdio-workbench/src/react/region/overlay-navigation.canvas.tsx#Navigation",
    );
    const returnPage = label === "Suspended" ? "Page suspended" : "Page one";
    if (label === "Suspended") await preview.getByRole("button", { name: returnPage, exact: true }).click();
    for (const ownership of ["controlled", "uncontrolled"]) {
      const trigger = preview.getByRole("button", { name: `${label} ${ownership} options`, exact: true });
      const overlay = preview.getByRole("dialog", { name: `${label} ${ownership} options`, exact: true });
      const draft = preview.getByRole("textbox", { name: `${label} draft`, exact: true });
      await draft.fill("Keep my draft");
      await trigger.click();
      await expect(overlay).toBeVisible();
      await overlay.getByRole("button", { name: "Navigate from options", exact: true }).click();
      await expect(preview.getByText("Destination page", { exact: true })).toBeVisible();
      await expect(overlay).toBeHidden();
      await preview.getByRole("button", { name: returnPage, exact: true }).click();
      await expect(draft).toHaveValue("Keep my draft");
      await expect(overlay).toBeHidden();
      await trigger.click();
      await expect(overlay).toBeVisible();
      await overlay.press("Escape");
      await expect(overlay).toBeHidden();
      await expect(trigger).toBeFocused();
    }
    const trigger = preview.getByRole("button", { name: `${label} help`, exact: true });
    const tooltip = preview.getByRole("tooltip", { name: `${label} help`, exact: true });
    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await trigger.press("n");
    await expect(preview.getByText("Destination page", { exact: true })).toBeVisible();
    await expect(tooltip).toBeHidden();
    await preview.getByRole("button", { name: returnPage, exact: true }).click();
    await expect(tooltip).toBeHidden();
    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await trigger.press("Escape");
    await expect(tooltip).toBeHidden();
  });
}

test("a retained status widget's tooltip closes when its mode is left", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/region/overlay-navigation.canvas.tsx#Navigation",
  );
  const trigger = preview.getByRole("button", { name: "Status help", exact: true });
  const tooltip = preview.getByRole("tooltip", { name: "Status help", exact: true });
  await trigger.hover();
  await expect(tooltip).toBeVisible();
  await trigger.press("n");
  await expect(preview.getByText("Destination page", { exact: true })).toBeVisible();
  await expect(tooltip).toBeHidden();
  await preview.getByRole("button", { name: "Page one", exact: true }).click();
  await expect(tooltip).toBeHidden();
  await trigger.hover();
  await expect(tooltip).toBeVisible();
});
