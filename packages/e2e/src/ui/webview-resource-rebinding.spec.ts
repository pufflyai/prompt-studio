import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("resource pages retain their browsing contexts and restore them on Back", async ({ page, request }) => {
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
    await page.goto(
      `/projects/${project.id}/extensions/pstdio.extension-lab/boombox/resource?resource=${encodeURIComponent("pstdio://extension-resource/boombox.track/paper-moon")}`,
    );
    const playlist = page.locator('iframe[title="Lazy Sunday"]:visible');
    await expect(playlist.contentFrame().getByText("Lazy Sunday", { exact: true })).toBeVisible();
    const original = (await (await playlist.elementHandle())!.contentFrame())!;
    await original.evaluate(() => Reflect.set(window, "resourceRebindingMarker", "original context"));
    await playlist.contentFrame().getByRole("button", { name: "Play Afterimage by", exact: false }).click();
    await expect(page).toHaveURL(/\/boombox\/resource\?resource=.*afterimage/);
    await expect(page.locator("iframe:visible")).toHaveCount(5);
    expect(original.isDetached()).toBe(false);
    expect(await (await original.frameElement()).isVisible()).toBe(false);
    const next = (await (await playlist.elementHandle())!.contentFrame())!;
    expect(next).not.toBe(original);
    await page.goBack();
    await expect(page).toHaveURL(/\/boombox\/resource\?resource=.*paper-moon/);
    await expect(page.locator("iframe:visible")).toHaveCount(5);
    expect(await (await original.frameElement()).isVisible()).toBe(true);
    expect(await original.evaluate(() => Reflect.get(window, "resourceRebindingMarker"))).toBe("original context");
    expect(next.isDetached()).toBe(false);
    expect(await (await next.frameElement()).isVisible()).toBe(false);
    await test.info().attach("resource-rebinding", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});
