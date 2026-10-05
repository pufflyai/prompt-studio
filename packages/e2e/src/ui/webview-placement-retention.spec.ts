import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("moving a webview between panels preserves its browsing context", async ({ page, request }) => {
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Moved webview retention" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    await page.goto(`/projects/${project.id}/`);
    await page.getByRole("option", { name: "Lab mode", exact: true }).click();
    const tab = page.getByRole("tab", { name: "Overview", exact: true });
    await expect(tab).toBeVisible();
    const element = page.locator('iframe[title="Overview"]');
    await expect(element).toBeVisible();
    await expect(element.contentFrame().getByRole("heading", { name: "Sandbox webview" })).toBeVisible();
    const frame = await (await element.elementHandle())?.contentFrame();
    expect(frame).toBeTruthy();
    await frame!.evaluate(() => Reflect.set(window, "placementMarker", "original context"));
    for (const destination of ["Side", "Main"]) {
      await tab.click({ button: "right" });
      await page.getByRole("menuitem", { name: `Move to ${destination}`, exact: true }).click();
      await expect(
        page
          .getByRole("region", { name: destination === "Side" ? "Side Panel" : "Main", exact: true })
          .locator('iframe[title="Overview"]'),
      ).toBeVisible();
      expect(frame!.isDetached()).toBe(false);
      expect(await frame!.evaluate(() => Reflect.get(window, "placementMarker"))).toBe("original context");
      await expect(tab).toBeVisible();
      if (destination === "Side") {
        await page.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
        await page.getByRole("button", { name: "Float Side Panel", exact: true }).click();
        await page.getByRole("button", { name: "Close Side Panel", exact: true }).click();
        await expect(element).toBeHidden();
        await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
        await expect(element).toBeVisible();
        expect(frame!.isDetached()).toBe(false);
        expect(await frame!.evaluate(() => Reflect.get(window, "placementMarker"))).toBe("original context");
      }
    }
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});
