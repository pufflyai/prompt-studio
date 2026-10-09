import { expect, type Page } from "@playwright/test";

export const expectPackagedStatusBarOrder = async (page: Page) => {
  await page.getByRole("option", { name: "Performance", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: "Enable performance monitoring" });
  await toggle.focus();
  await toggle.press("Space");
  await expect(toggle).toBeChecked();
  await page.getByRole("button", { name: "Close Performance", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const connection = page.getByRole("group", { name: "Backend connection", exact: true });
  const performance = page.getByRole("group", { name: "Performance", exact: true });
  const isConnectionFirst = async () => {
    const first = await connection.boundingBox();
    const second = await performance.boundingBox();
    return Boolean(first && second && first.x < second.x);
  };
  await expect(connection).toBeAttached();
  await expect(performance).toBeAttached();
  await connection.hover();
  const source = await connection.boundingBox();
  const target = await performance.boundingBox();
  if (!source || !target) throw new Error("Both status bar widgets must be visible.");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 4, target.y + target.height / 2, { steps: 12 });
  await expect(page.locator("[data-status-bar-item][data-dragging]")).toHaveCount(1);
  await page.mouse.up();
  await expect.poll(isConnectionFirst).toBe(true);
  await connection.focus();
  await connection.press("Alt+ArrowRight");
  await expect.poll(isConnectionFirst).toBe(false);
  await expect(connection).toBeFocused();
  await connection.press("Alt+ArrowLeft");
  await expect.poll(isConnectionFirst).toBe(true);
  await page.reload();
  await expect.poll(isConnectionFirst).toBe(true);
  // A widget's control is also a drag surface, and a click still opens its popover.
  const meter = page.getByTestId("performance-status-item");
  const meterBounds = await meter.boundingBox();
  const connectionBounds = await connection.boundingBox();
  if (!meterBounds || !connectionBounds) throw new Error("Both status bar controls must be visible.");
  await page.mouse.move(meterBounds.x + meterBounds.width / 2, meterBounds.y + meterBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    connectionBounds.x + connectionBounds.width / 4,
    connectionBounds.y + connectionBounds.height / 2,
    { steps: 12 },
  );
  await expect(page.locator("[data-status-bar-item][data-dragging]")).toHaveCount(1);
  await page.mouse.up();
  await expect.poll(isConnectionFirst).toBe(false);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await meter.focus();
  await meter.press("Alt+ArrowRight");
  await expect.poll(isConnectionFirst).toBe(true);
  await expect(meter).toBeFocused();
  await meter.click({ delay: 100 });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByRole("option", { name: "Performance", exact: true }).click();
  await toggle.focus();
  await toggle.press("Space");
  await expect(performance).not.toBeVisible();
  await toggle.press("Space");
  await expect(toggle).toBeChecked();
  await page.getByRole("button", { name: "Close Performance", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect.poll(isConnectionFirst).toBe(true);
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByText("Connection", { exact: true }).click();
};
