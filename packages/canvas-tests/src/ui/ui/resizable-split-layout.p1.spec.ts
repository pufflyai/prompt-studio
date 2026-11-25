import { expect, type Locator, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const BOTTOM_SPLIT = "packages/ui/src/components/layout/resizable-split-layout.canvas.tsx#BottomPanel";

test.use({ hasTouch: true });

const previewSize = (separator: Locator) =>
  separator.evaluate((element) => Number.parseFloat(element.parentElement!.style.getPropertyValue("--split-size")));

const pointOnDivider = async (separator: Locator, across: number) => {
  const bounds = await separator.boundingBox();
  if (!bounds) throw new Error("The divider is outside the preview");
  return { x: Math.round(bounds.x + bounds.width * across), y: Math.round(bounds.y + bounds.height / 2) };
};

// Critical: a second finger must not disrupt a resize or commit a size while the first is still dragging.
for (const location of ["away from the divider", "on the divider"]) {
  test(`keep the first touch resizing when a second touch starts ${location}`, async ({ page, context }) => {
    const preview = await openCanvasPreview(page, BOTTOM_SPLIT);
    const separator = preview.getByRole("separator", { name: "Resize secondary panel", exact: true });
    const client = await context.newCDPSession(page);
    const initial = Number(await separator.getAttribute("aria-valuenow"));
    await separator.evaluate((element) => {
      for (const type of ["pointerdown", "pointermove", "pointerup"] as const) {
        element.ownerDocument.addEventListener(
          type,
          (event) => {
            if (event.isTrusted && event.pointerType === "touch" && !event.isPrimary) {
              element.setAttribute(
                `data-second-${type}`,
                event.composedPath().includes(element) ? "divider" : "outside",
              );
            }
          },
          { capture: true },
        );
      }
    });

    const first = { id: 11, ...(await pointOnDivider(separator, 0.25)) };
    const firstMoved = { ...first, y: first.y - 24 };
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [firstMoved] });
    await expect.poll(() => previewSize(separator)).toBeGreaterThan(initial);
    const firstSize = await previewSize(separator);

    const second = { id: 22, ...(await pointOnDivider(separator, 0.7)) };
    const onDivider = location === "on the divider";
    if (!onDivider) second.y += 25;
    const secondMoved = { ...second, y: second.y + 18 };
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [firstMoved, second] });
    await expect(separator).toHaveAttribute("data-second-pointerdown", onDivider ? "divider" : "outside");
    await expect(separator).toHaveAttribute("aria-valuenow", String(initial));

    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [firstMoved, secondMoved] });
    await expect(separator).toHaveAttribute("data-second-pointermove", /^(divider|outside)$/);
    await separator.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    expect(await previewSize(separator)).toBe(firstSize);
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [secondMoved] });
    await expect(separator).toHaveAttribute("data-second-pointerup", /^(divider|outside)$/);
    await expect(separator).toHaveAttribute("aria-valuenow", String(initial));

    const firstMovedAgain = { ...firstMoved, y: firstMoved.y - 18 };
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [firstMovedAgain] });
    await expect.poll(() => previewSize(separator)).toBeGreaterThan(firstSize);
    const final = await previewSize(separator);
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(separator).toHaveAttribute("aria-valuenow", String(Math.round(final)));
  });
}

test("settle a canceled touch resize and let the next touch resize again", async ({ page, context }) => {
  const preview = await openCanvasPreview(page, BOTTOM_SPLIT);
  const separator = preview.getByRole("separator", { name: "Resize secondary panel", exact: true });
  const client = await context.newCDPSession(page);
  await separator.evaluate((element) => {
    element.addEventListener("pointercancel", (event) => {
      if (event instanceof PointerEvent && event.isTrusted && event.pointerType === "touch" && event.isPrimary) {
        element.setAttribute("data-primary-touch-canceled", "true");
      }
    });
  });

  const initial = Number(await separator.getAttribute("aria-valuenow"));
  const first = { id: 11, ...(await pointOnDivider(separator, 0.5)) };
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, y: first.y - 24 }] });
  await expect.poll(() => previewSize(separator)).toBeGreaterThan(initial);
  const canceledSize = await previewSize(separator);
  await expect(separator).toHaveAttribute("aria-valuenow", String(initial));
  await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(separator).toHaveAttribute("data-primary-touch-canceled", "true");
  await expect(separator).toHaveAttribute("aria-valuenow", String(Math.round(canceledSize)));
  expect(await previewSize(separator)).toBe(canceledSize);

  const second = { id: 22, ...(await pointOnDivider(separator, 0.5)) };
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [second] });
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...second, y: second.y - 24 }] });
  await expect.poll(() => previewSize(separator)).toBeGreaterThan(canceledSize);
  const final = await previewSize(separator);
  await expect(separator).toHaveAttribute("aria-valuenow", String(Math.round(canceledSize)));
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(separator).toHaveAttribute("aria-valuenow", String(Math.round(final)));
});

test("resize the divider with the mouse and keyboard", async ({ page }) => {
  const preview = await openCanvasPreview(page, BOTTOM_SPLIT);
  const separator = preview.getByRole("separator", { name: "Resize secondary panel", exact: true });
  const initial = Number(await separator.getAttribute("aria-valuenow"));
  const point = await pointOnDivider(separator, 0.5);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y - 24);
  await page.mouse.up();
  await expect.poll(async () => Number(await separator.getAttribute("aria-valuenow"))).toBeGreaterThan(initial);

  const afterMouse = Number(await separator.getAttribute("aria-valuenow"));
  await separator.press("ArrowUp");
  await expect.poll(async () => Number(await separator.getAttribute("aria-valuenow"))).toBeGreaterThan(afterMouse);
});
