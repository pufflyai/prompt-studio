import { expect, type FrameLocator, type Page } from "@playwright/test";

const captureDocument = (frame: FrameLocator) =>
  frame.locator("body").evaluate(() => {
    const id = crypto.randomUUID();
    (window as unknown as { selectionTestDocument: string }).selectionTestDocument = id;
    return id;
  });
const expectDocument = async (frame: FrameLocator, id: string) =>
  expect(
    await frame
      .locator("body")
      .evaluate(() => (window as unknown as { selectionTestDocument: string }).selectionTestDocument),
  ).toBe(id);

export const verifyLabSelection = async (page: Page, projectUrl: string) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const loaded = (name: string) =>
    page.waitForResponse(
      (response) =>
        response.url().includes("state.read/execute") &&
        response.ok() &&
        response.request().postDataJSON()?.params?.name === name,
    );
  const open = async (name: string) => {
    const ready = loaded(name.toLowerCase());
    await page.goto(projectUrl);
    await page.getByRole("option", { name, exact: true }).click();
    await ready;
  };
  await open("Boombox");
  await expect(page.getByRole("button", { name: "Enter Main fullscreen", exact: true })).toHaveCount(0);
  const playlist = page.frameLocator('iframe[title="Lazy Sunday"]');
  const player = page.frameLocator('iframe[title="Player"]');
  await expect(playlist.getByRole("button", { name: "Play Afterimage by Hollow Coast" })).toBeVisible();
  await expect(page.getByLabel("Main panel header", { exact: true })).toHaveCount(0);
  const boomboxDocument = await captureDocument(playlist);
  const boomboxPath = new URL(page.url()).pathname;
  const history = await page.evaluate(() => window.history.length);
  await playlist.getByRole("button", { name: "Play Afterimage by Hollow Coast" }).click();
  await expect(player.getByText("Afterimage", { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(boomboxPath);
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  await expectDocument(playlist, boomboxDocument);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/extensions/commands/*state.update/execute", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await playlist.getByRole("button", { name: "Like Afterimage", exact: true }).click();
    await expect(player.getByRole("button", { name: "Unlike current track", exact: true })).toBeVisible();
  } finally {
    release();
  }
  await page.unrouteAll({ behavior: "wait" });

  await open("Pigeon");
  const inbox = page.frameLocator('iframe[title="Inbox"]');
  const reader = page.frameLocator('iframe[title="Message"]');
  await expect(
    inbox.getByRole("listitem", { name: "Open message: Launch notes for Friday", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Main panel header", { exact: true })).toHaveCount(0);
  const inboxDocument = await captureDocument(inbox);
  const pigeonPath = new URL(page.url()).pathname;
  for (const subject of ["Launch notes for Friday", "Main is green again"]) {
    await inbox.getByRole("listitem", { name: `Open message: ${subject}`, exact: true }).click();
    await expect(reader.getByText(subject, { exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(pigeonPath);
    await expectDocument(inbox, inboxDocument);
    await expect(
      page.locator('[data-workbench-panel="side"]').getByRole("tab", { name: "Message", exact: true }),
    ).toBeVisible();
  }

  await open("Kiln");
  const viewport = page.frameLocator('iframe[title="3D viewport"]');
  const inspector = page.frameLocator('iframe[title="Scene and properties"]');
  await expect(viewport.getByRole("button", { name: "Reset view", exact: true })).toBeVisible();
  await expect(page.getByLabel("Main panel header", { exact: true })).toHaveCount(0);
  const sceneDocument = await captureDocument(viewport);
  const kilnPath = new URL(page.url()).pathname;
  await inspector.getByRole("button", { name: "Sphere", exact: true }).click();
  await expect(inspector.getByRole("spinbutton", { name: "Sphere position X", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(kilnPath);
  await expectDocument(viewport, sceneDocument);
  await expect(main.getByRole("tab")).toHaveCount(0);
  const side = page.locator('[data-workbench-panel="side"]');
  await expect(side.locator('iframe[title="Scene and properties"]:visible')).toBeVisible();
  await expect(side.getByRole("tab")).toHaveCount(0);
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("state.update/execute") && response.request().method() === "POST" && response.ok(),
  );
  await inspector.getByRole("spinbutton", { name: "Sphere position X", exact: true }).fill("4.2");
  await inspector.getByRole("spinbutton", { name: "Sphere position X", exact: true }).press("Tab");
  await saved;
  const restored = loaded("kiln");
  await page.reload();
  await restored;
  await expect(inspector.getByRole("spinbutton", { name: "Sphere position X", exact: true })).toHaveValue("4.2");

  await open("Zipline");
  await expect(main.getByRole("button", { name: "Polish command menu transitions", exact: true })).toBeVisible();
  await expect(page.locator('[data-workbench-tab-strip="main"]')).toHaveCount(0);
};
