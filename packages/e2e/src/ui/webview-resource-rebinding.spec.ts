import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("a single-resource view keeps its browsing context when selecting another resource", async ({ page, request }) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Resource rebinding" }),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  try {
    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    await page.goto(`/projects/${project.id}/`);
    await page.getByRole("option", { name: "Boombox", exact: true }).click();
    const playlist = page.locator('iframe[title="Lazy Sunday"]');
    await expect(playlist.contentFrame().getByText("Lazy Sunday", { exact: true })).toBeVisible();
    await expect(page.locator("iframe:visible")).toHaveCount(4);
    const frames = page.frames().filter((frame) => frame !== page.mainFrame());
    for (const frame of frames) {
      await frame.evaluate(() => Reflect.set(window, "resourceRebindingMarker", "original context"));
    }
    for (const [title, id] of [
      ["Paper Moon", "paper-moon"],
      ["Afterimage", "afterimage"],
      ["Soft Focus", "soft-focus"],
    ]) {
      await playlist
        .contentFrame()
        .getByRole("button", { name: `Play ${title} by`, exact: false })
        .click();
      await expect(page).toHaveURL(new RegExp(`/boombox/resource\\?resource=.*${id}`));
      await expect(page.locator("iframe")).toHaveCount(4);
      for (const frame of frames) {
        expect(frame.isDetached()).toBe(false);
        expect(await frame.evaluate(() => Reflect.get(window, "resourceRebindingMarker"))).toBe("original context");
        expect(await (await frame.frameElement()).isVisible()).toBe(true);
      }
    }
    await page.goBack();
    await expect(page.locator("iframe")).toHaveCount(4);
    await test.info().attach("resource-rebinding", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});
