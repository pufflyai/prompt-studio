import { expect, type Frame, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

for (const action of ["Script navigation", "Link navigation", "Meta refresh"]) {
  test(`blocks remote preview requests from ${action.toLowerCase()}`, async ({ page }) => {
    const storyId = "extensions-artifacts-htmlpreview--navigation-isolation";
    const { baseUrl, storybook } = await startStorybook(storyId, "pstdio-dashboard");
    const requests: string[] = [];
    await page.route("https://artifact-network.test/**", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({ contentType: "text/html", body: "<h1>Remote page</h1>" });
    });
    try {
      await page.goto(storyUrl(baseUrl, storyId));
      await expect(page.locator('iframe[title="Navigation isolation"]')).toBeVisible();
      let preview: Frame | undefined;
      await expect
        .poll(async () => {
          for (const frame of page.frames()) {
            if (await frame.getByRole("button", { name: "Mark complete", exact: true }).count()) preview = frame;
          }
          return !!preview;
        })
        .toBe(true);
      await preview!.getByRole("button", { name: "Mark complete", exact: true }).click();
      await expect(preview!.getByRole("button", { name: "Complete", exact: true })).toBeVisible();
      await preview!.getByRole(action === "Link navigation" ? "link" : "button", { name: action }).click();
      await expect.poll(() => preview!.url()).not.toBe("about:srcdoc");
      expect(requests).toEqual([]);
    } finally {
      await stopStorybook(storybook);
    }
  });
}
