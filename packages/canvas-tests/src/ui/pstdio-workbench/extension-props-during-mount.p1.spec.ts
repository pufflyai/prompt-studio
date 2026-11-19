import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: props committed while guest initialization is pending must reach that guest.
test("host props committed during async mount reach the initialized guest", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/pending-extension-props.canvas.tsx#DuringMount",
  );
  const guest = preview.frameLocator('iframe[title="Pending props"]');
  await expect(guest.locator("#mounted")).toHaveText("pending");
  await expect(guest.locator("#range")).toHaveText("now-6h");
  await preview.getByRole("button", { name: "Update host props", exact: true }).click();
  await expect(preview.getByLabel("Committed host range", { exact: true })).toHaveText("now-24h");
  await expect(guest.locator("#mounted")).toHaveText("pending");
  await guest.getByRole("button", { name: "Finish mount", exact: true }).click();
  await expect(guest.locator("#mounted")).toHaveText("done");
  await expect(guest.locator("#range")).toHaveText("now-24h");
});

test("replacing either guest URL releases the previous guest's registrations", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/pending-extension-props.canvas.tsx#DuringMount",
  );
  const guest = preview.frameLocator('iframe[title="Pending props"]');
  const disconnects = preview.getByTestId("guest-disconnects");
  for (const replacement of ["runtime", "module"]) {
    await expect(guest.getByRole("button", { name: "Finish mount" })).toBeVisible();
    const before = Number(await disconnects.textContent());
    await preview.getByRole("button", { name: `Replace guest ${replacement}` }).click();
    await expect(disconnects).toHaveText(String(before + 1));
  }
});
