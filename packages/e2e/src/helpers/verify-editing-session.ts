import { expect, type Page } from "@playwright/test";

export const verifyEditingSession = async (page: Page) => {
  const canvas = page.frameLocator('iframe[title="Editing canvas"]:visible');
  const inspector = page.frameLocator('iframe[title="Editing inspector"]:visible');
  const first = canvas.getByRole("textbox", { name: "Title", exact: true });
  const second = inspector.getByRole("textbox", { name: "Title", exact: true });
  await expect(first).toHaveValue("Original");
  const showSide = page.getByRole("button", { name: "Show Side Panel", exact: true });
  if (await showSide.isVisible()) await showSide.click();
  await expect(second).toHaveValue("Original");
  const pattern = "**/test.editing-fixture.command.editing.save/execute";
  const writes: unknown[] = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received = () => {};
  const requested = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route(pattern, async (route) => {
    writes.push(route.request().postDataJSON());
    if (writes.length === 1) {
      received();
      await held;
    }
    await route.continue();
  });
  try {
    await first.fill("A");
    await requested;
    await expect(second).toHaveValue("A");
    await second.fill("AB");
    await expect(first).toHaveValue("AB");
    await first.fill("ABC");
    await expect(second).toHaveValue("ABC");
    expect(writes).toHaveLength(1);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("test.editing-fixture.command.editing.save/execute") &&
        (response.request().postData()?.includes("ABC") ?? false) &&
        response.ok(),
    );
    release();
    await saved;
    expect(writes).toHaveLength(2);
  } finally {
    release();
    await page.unroute(pattern);
  }
  await page.reload();
  await expect(first).toHaveValue("ABC");
  await expect(second).toHaveValue("ABC");
  await canvas.getByRole("button", { name: "Preview move", exact: true }).click();
  await expect(canvas.getByRole("alert")).toBeEmpty();
  await expect(canvas.getByRole("status", { name: "Position" })).toHaveText("12, 24");
  await expect(inspector.getByRole("status", { name: "Position" })).toHaveText("12, 24");
  await canvas.getByRole("button", { name: "Cancel move", exact: true }).click();
  await expect(inspector.getByRole("status", { name: "Position" })).toHaveText("0, 0");
  await page.reload();
  await expect(inspector.getByRole("status", { name: "Position" })).toHaveText("0, 0");
  await canvas.getByRole("button", { name: "Preview move", exact: true }).click();
  const saved = page.waitForResponse(
    (response) => response.url().endsWith("test.editing-fixture.command.editing.save/execute") && response.ok(),
  );
  await canvas.getByRole("button", { name: "Commit move", exact: true }).click();
  await saved;
  await page.reload();
  await expect(inspector.getByRole("status", { name: "Position" })).toHaveText("12, 24");
  await expect(canvas.getByRole("alert")).toBeEmpty();
  await expect(inspector.getByRole("alert")).toBeEmpty();
};
