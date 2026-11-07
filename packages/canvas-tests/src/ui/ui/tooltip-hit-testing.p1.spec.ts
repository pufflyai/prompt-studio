import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a noninteractive tooltip must not block an essential action beneath its floating layer.
test("a noninteractive tooltip allows a nearby action underneath its positioner", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/tooltip.canvas.tsx#Default",
    "Pointer through",
  );
  await expect(preview.getByRole("tooltip")).toBeVisible();
  await preview.getByRole("button", { name: "Nearby action", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Action completed", exact: true })).toBeVisible();
});

test("an interactive tooltip retains its own action", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/tooltip.canvas.tsx#Default",
    "Interactive",
  );
  await preview.getByRole("button", { name: "Tooltip action", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Tooltip action completed", exact: true })).toBeVisible();
});

// Critical: hidden clipped-label tooltips must not force layout as a tool mounts its rows.
test("clipped labels measure on intent and retain focus across eligibility changes", async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth")!;
    Object.defineProperty(Element.prototype, "scrollWidth", {
      ...descriptor,
      get() {
        if (this.tagName === "SPAN" && this.textContent === "Session notes for review") {
          Reflect.set(window, "tooltipLabelReads", (Reflect.get(window, "tooltipLabelReads") ?? 0) + 1);
        }
        return descriptor.get!.call(this);
      },
    });
  });
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/tooltip.canvas.tsx#Default",
    "Truncated label",
  );
  const trigger = preview.getByRole("tab", { name: "Session notes for review", exact: true });
  const original = await trigger.elementHandle();
  const reads = () =>
    trigger.evaluate((element) => Reflect.get(element.ownerDocument.defaultView!, "tooltipLabelReads") ?? 0);
  expect(await reads()).toBe(0);
  await trigger.hover();
  await expect(preview.getByRole("tooltip")).toBeVisible();
  expect(await reads()).toBeGreaterThan(0);
  await preview.getByRole("button", { name: "Toggle width", exact: true }).click();
  await trigger.hover();
  await expect(preview.getByRole("tooltip")).toHaveCount(0);
  await preview.getByRole("button", { name: "Toggle width", exact: true }).click();
  await trigger.hover();
  await expect(preview.getByRole("tooltip")).toBeVisible();
  await preview.getByRole("button", { name: "Toggle tooltips", exact: true }).click();
  await trigger.hover();
  await expect(preview.getByRole("tooltip")).toHaveCount(0);
  await preview.getByRole("button", { name: "Toggle tooltips", exact: true }).click();
  for (let index = 0; index < 3; index++) await page.keyboard.press("Shift+Tab");
  await expect(trigger).toBeFocused();
  await expect(preview.getByRole("tooltip")).toBeVisible();
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
});

test("a fresh clipped tooltip opens from keyboard focus, describes its trigger and releases Escape", async ({
  page,
}) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/primitives/tooltip.canvas.tsx#Default",
    "Truncated label",
  );
  const trigger = preview.getByRole("tab", { name: "Session notes for review", exact: true });
  await preview.getByRole("button", { name: "Choose example", exact: true }).press("Tab");
  await expect(trigger).toBeFocused();
  const tooltip = preview.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  expect(await trigger.getAttribute("aria-describedby")).toBe(await tooltip.getAttribute("id"));
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
