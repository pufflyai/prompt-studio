import { expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

const boomboxFrames = async (page: Page) => {
  const titles = ["Lazy Sunday", "Player", "Boombox", "Library", "Queue"];
  return Promise.all(
    titles.map(async (title) => {
      const view = page.locator(`iframe[title="${title}"]:visible`);
      await expect(view).toBeVisible();
      return (await (await view.elementHandle())!.contentFrame())!;
    }),
  );
};

test("returning to Boombox reuses its live webviews across other modes and browser history", async ({
  page,
  request,
}) => {
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Webview retention" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, project.id);
    await page.goto(`/projects/${project.id}/`);
    await page.getByText("Boombox", { exact: true }).click();
    await expect(
      page.frameLocator('iframe[title="Lazy Sunday"]').getByText("Lazy Sunday", { exact: true }),
    ).toBeVisible();
    const frames = await boomboxFrames(page);
    for (const frame of frames) {
      await frame.evaluate(() => {
        Reflect.set(window, "retentionMarker", "original browsing context");
      });
    }

    await page.goBack();
    await expect(page.getByText("Boombox", { exact: true })).toBeVisible();
    for (const frame of frames) {
      expect(frame.isDetached()).toBe(false);
      expect(await (await frame.frameElement()).isVisible()).toBe(false);
      expect(await (await frame.frameElement()).evaluate((element) => Boolean(element.closest("[inert]")))).toBe(true);
    }
    await page.getByText("Scribble", { exact: true }).click();
    await page.waitForURL(/\/scribble\//);
    await expect(page.locator('iframe[title="Document"]:visible')).toBeVisible();
    await page.goBack();
    await page.getByText("Boombox", { exact: true }).click();
    await boomboxFrames(page);
    for (const frame of frames) {
      expect(frame.isDetached()).toBe(false);
      expect(await frame.evaluate(() => Reflect.get(window, "retentionMarker"))).toBe("original browsing context");
      expect(await (await frame.frameElement()).isVisible()).toBe(true);
    }
    await test.info().attach("retained-webviews", { body: await page.screenshot(), contentType: "image/png" });

    await page.goBack();
    const extensionsResponse = await request.get(`${uiOrigin}/v1/projects/${project.id}/extensions`);
    const { extensions } = (await extensionsResponse.json()) as {
      extensions: Array<{ id: string; installName: string }>;
    };
    const lab = extensions.find((extension) => extension.installName === "extension-lab");
    expect(lab).toBeTruthy();
    const disabled = await request.patch(`${uiOrigin}/v1/projects/${project.id}/extensions/${lab!.id}`, {
      data: { enabled: false },
    });
    expect(disabled.ok()).toBe(true);
    await expect.poll(() => frames.every((frame) => frame.isDetached())).toBe(true);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});

test("switching projects releases the previous project's retained webviews", async ({ page, request }) => {
  const projects: Array<{ id: string; name: string }> = [];
  try {
    for (const name of ["First retention project", "Second retention project"]) {
      const response = await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({ name }) });
      expect(response.ok()).toBe(true);
      projects.push(await response.json());
    }
    await page.addInitScript((projectId: string) => {
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, projects[0].id);
    await page.goto(`/projects/${projects[0].id}/`);
    await page.getByText("Boombox", { exact: true }).click();
    const frames = await boomboxFrames(page);
    await page.goBack();
    expect(frames.every((frame) => !frame.isDetached())).toBe(true);
    await page.getByRole("button", { name: "Switch project", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Projects", exact: true });
    await picker.getByText(projects[1].name, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projects[1].id}`));
    await expect.poll(() => frames.every((frame) => frame.isDetached())).toBe(true);
    await expect(page.getByTestId("start-page")).toBeVisible();
  } finally {
    for (const project of projects) await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});
