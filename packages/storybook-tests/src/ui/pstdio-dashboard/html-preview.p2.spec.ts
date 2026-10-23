import { expect, type Frame, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl } from "../storybook";

test("artifact sandbox relays keyboard entry and tab chords while preserving editing", async ({ page }) => {
  const storyId = "extensions-artifacts-htmlpreview--keyboard-handoff";
  const { baseUrl, storybook } = await startStorybook(storyId, "pstdio-dashboard");
  try {
    await page.goto(storyUrl(baseUrl, storyId));
    const editor = page
      .frameLocator('iframe[title="Nested keyboard editor"]')
      .frameLocator("iframe")
      .getByRole("textbox", { name: "Artifact draft" });
    await editor.fill("Keep this unsaved draft");
    await editor.press("ArrowLeft");
    await expect.poll(() => editor.evaluate((input: HTMLTextAreaElement) => input.selectionStart)).toBe(22);
    await editor.press("Alt+Shift+Space");
    await expect(page.getByLabel("Keyboard request")).toHaveText("leader");
    await expect(page.getByRole("heading", { name: "Keyboard handoff" })).toBeFocused();
    await page.keyboard.press("v");
    await expect(editor).toHaveValue("Keep this unsaved draft");
    await page.getByRole("button", { name: "Restore editor" }).click();
    await expect(editor).toBeFocused();
    expect(await editor.evaluate((input: HTMLTextAreaElement) => input.selectionStart)).toBe(22);
    await editor.press("Alt+Shift+4");
    await expect(page.getByLabel("Keyboard request")).toHaveText("tab-four");
    await editor.press("Alt+Shift+X");
    await expect(page.getByLabel("Keyboard request")).toHaveText("tab-four");
    await expect(editor).toHaveValue("Keep this unsaved draft");
  } finally {
    await stopStorybook(storybook);
  }
});

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
