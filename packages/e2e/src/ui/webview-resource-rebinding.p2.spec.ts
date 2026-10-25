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
      `/projects/${project.id}/extensions/pstdio.extension-lab/scribble/resource?resource=${encodeURIComponent("pstdio://extension-resource/scribble.document/north-star")}`,
    );
    const document = page.locator('iframe[title="Document"]:visible');
    await expect(document.contentFrame().locator('[contenteditable="true"]').first()).toContainText("Why now");
    const original = (await (await document.elementHandle())!.contentFrame())!;
    await original.evaluate(() => Reflect.set(window, "resourceRebindingMarker", "original context"));
    await page
      .frameLocator('iframe[title="Pages"]:visible')
      .getByRole("button", { name: "Field notes", exact: true })
      .click();
    await expect(page).toHaveURL(/\/scribble\/resource\?resource=.*field-notes/);
    await expect(document).toHaveCount(1);
    expect(original.isDetached()).toBe(false);
    expect(await (await original.frameElement()).isVisible()).toBe(false);
    const next = (await (await document.elementHandle())!.contentFrame())!;
    expect(next).not.toBe(original);
    await page.goBack();
    await expect(page).toHaveURL(/\/scribble\/resource\?resource=.*north-star/);
    await expect(document).toHaveCount(1);
    expect(await (await original.frameElement()).isVisible()).toBe(true);
    expect(await original.evaluate(() => Reflect.get(window, "resourceRebindingMarker"))).toBe("original context");
    expect(next.isDetached()).toBe(false);
    expect(await (await next.frameElement()).isVisible()).toBe(false);
    await test.info().attach("resource-rebinding", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});
