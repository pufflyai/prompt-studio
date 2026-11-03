import { expect, type Frame, type Locator, type Page, test } from "@playwright/test";

const checkTimelineTransport = async (props: {
  page: Page;
  surface: Frame;
  first: Locator;
  second: Locator;
  timeline: Locator;
  output: Locator;
}) => {
  const { page, surface, first, second, timeline, output } = props;
  const loop = timeline.getByRole("button", { name: "Loop playback", exact: true });
  await expect(loop).toBeVisible();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await second.locator("[data-canvas-select]").click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await first.locator("[data-canvas-select]").click();
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await loop.press("Space");
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  const timeRuler = timeline.getByRole("slider", { name: "Timeline playhead", exact: true });
  const camera = surface.getByRole("button", { name: /Reset zoom to 100%/ });
  const cameraBefore = await camera.getAttribute("aria-label");
  const rulerWidth = await timeRuler.evaluate((element) => element.clientWidth);
  const timeBounds = (await timeRuler.boundingBox())!;
  await page.mouse.move(timeBounds.x + timeBounds.width * 0.4, timeBounds.y + timeBounds.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -160);
  await page.keyboard.up("Control");
  await expect.poll(() => timeRuler.evaluate((element) => element.clientWidth)).toBeGreaterThan(rulerWidth * 1.2);
  await expect(camera).toHaveAttribute("aria-label", cameraBefore!);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 10000);
  await page.keyboard.up("Control");
  const tracks = timeline.getByRole("group", { name: "Animation tracks", exact: true });
  await expect
    .poll(() =>
      tracks.locator('[data-part="viewport"]').evaluate((element) => element.scrollWidth - element.clientWidth),
    )
    .toBe(0);
  await expect(tracks.locator('[data-part="scrollbar"][data-orientation="horizontal"]')).toBeHidden();
  await expect(output).toContainText('"time":0');
};

// Critical: host parameters must retain local input, isolate siblings and control motion precisely.
test("frame parameters and playback stay independent across themes and movement", async ({ page }) => {
  await page.addInitScript(() =>
    window.addEventListener("message", ({ source, data }) => {
      if (data?.protocol !== "pstdio.canvas.preview" || data.type !== "loaded") return;
      for (const frame of window.document.querySelectorAll("iframe"))
        if (frame.contentWindow === source) frame.dataset.testNonce = data.nonce;
    }),
  );
  await page.goto("/?canvas=packages%2Fui%2Fsrc%2Ffoundations%2Fframe-parameters.canvas.tsx");
  const surface = (await (await page.locator("[data-verification-host]").elementHandle())!.contentFrame())!;
  const first = surface.locator('[data-canvas-item="First"]');
  const second = surface.locator('[data-canvas-item="Second"]');
  const document = first.frameLocator("iframe");
  const output = document.locator("[data-parameters-preview]");
  await expect(surface.locator('iframe[data-frame-ready="true"]')).toHaveCount(3);
  const menu = surface.getByRole("complementary", { name: "Frame editor" });
  await expect(menu).toBeHidden();
  await expect(surface.getByRole("button", { name: "Open frame parameters", exact: true })).toHaveCount(0);
  await expect(surface.getByRole("button", { name: "Open animation timeline", exact: true })).toHaveCount(0);
  await expect(surface.getByRole("region", { name: /^Animations/ })).toHaveCount(0);
  // Fit both comparison frames beside the editor before interacting with them.
  await surface.locator("[data-canvas-viewport]").press("f");
  await first.locator("[data-canvas-select]").click();
  await document.getByRole("textbox", { name: "Frame draft" }).fill("Keep this input");
  const timeline = surface.getByRole("region", { name: /^Animations/ });
  await expect(timeline).toBeVisible();
  await checkTimelineTransport({ page, surface, first, second, timeline, output });
  const dialog = surface.getByRole("complementary", { name: "Frame editor" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("spinbutton").first().fill("7");
  await dialog.getByRole("spinbutton").first().press("Tab");
  await expect(output).toContainText('"amount":7');
  await dialog.getByRole("button", { name: "Calm", exact: true }).click();
  await second.locator("[data-canvas-select]").click();
  await expect(dialog).toBeVisible();
  await expect(surface.getByRole("menuitemradio", { name: "Bright", exact: true })).not.toBeVisible();
  await expect(dialog.getByRole("spinbutton").first()).toHaveValue("2");
  await first.locator("[data-canvas-select]").click();
  await expect(dialog.getByRole("spinbutton").first()).toHaveValue("7");
  await expect(document.getByRole("textbox", { name: "Frame draft" })).toHaveValue("Keep this input");
  // Dragging panels closed must keep selection, edits, iframe input and the other panel.
  const viewport = surface.locator("[data-canvas-viewport]");
  await expect(surface.getByRole("button", { name: "Open frame parameters", exact: true })).toHaveCount(0);
  await expect(surface.getByRole("button", { name: "Open animation timeline", exact: true })).toHaveCount(0);
  const viewportBefore = (await viewport.boundingBox())!;
  const tray = surface.locator("[data-animation-tray]");
  const trayBounds = (await tray.boundingBox())!;
  const toolbarBounds = (await timeline.getByRole("toolbar", { name: "Animation controls" }).boundingBox())!;
  const laneBounds = (await timeline
    .getByRole("slider", { name: "Timeline playhead", exact: true })
    .locator("../..")
    .boundingBox())!;
  expect(trayBounds.height).toBeLessThanOrEqual(toolbarBounds.height + laneBounds.height + 3);
  const editorWidth = (await dialog.boundingBox())!.width;
  const sideDivider = (await surface
    .getByRole("separator", { name: "Resize frame editor", exact: true })
    .boundingBox())!;
  await page.mouse.move(sideDivider.x + sideDivider.width / 2, sideDivider.y + sideDivider.height / 2);
  await page.mouse.down();
  await page.mouse.move(sideDivider.x + editorWidth - 20, sideDivider.y + sideDivider.height / 2);
  await page.mouse.up();
  await expect(dialog).toBeHidden();
  await expect(timeline).toBeVisible();
  expect((await viewport.boundingBox())!.width).toBeGreaterThan(viewportBefore.width);
  await surface.getByRole("button", { name: "Open frame parameters", exact: true }).click();
  await expect(dialog.getByRole("spinbutton").first()).toHaveValue("7");
  await expect(surface.getByRole("button", { name: "Open frame parameters", exact: true })).toHaveCount(0);
  const bottomDivider = (await surface
    .getByRole("separator", { name: "Resize animation timeline", exact: true })
    .boundingBox())!;
  await page.mouse.move(bottomDivider.x + bottomDivider.width / 2, bottomDivider.y);
  await page.mouse.down();
  await page.mouse.move(bottomDivider.x + bottomDivider.width / 2, bottomDivider.y + trayBounds.height - 16);
  await page.mouse.up();
  await expect(timeline).toBeHidden();
  await expect(dialog).toBeVisible();
  await surface.getByRole("button", { name: "Open animation timeline", exact: true }).click();
  await expect(timeline).toBeVisible();
  await expect(surface.getByRole("button", { name: "Open animation timeline", exact: true })).toHaveCount(0);
  await expect(document.getByRole("textbox", { name: "Frame draft" })).toHaveValue("Keep this input");
  // A smaller open tray must scroll its rows instead of clipping them at the split boundary.
  const timelineDivider = surface.getByRole("separator", { name: "Resize animation timeline", exact: true });
  for (let step = 0; step < 3; step++) await timelineDivider.press("ArrowDown");
  await expect(timelineDivider).toHaveAttribute("aria-valuenow", "128");
  await expect.poll(async () => (await timeline.boundingBox())!.height).toBeLessThanOrEqual(128);
  const marker = timeline.getByRole("button", { name: "Midpoint", exact: true });
  await marker.scrollIntoViewIfNeeded();
  const scrollBounds = (await timeline
    .getByRole("group", { name: "Animation tracks", exact: true })
    .locator('[data-part="viewport"]')
    .boundingBox())!;
  const markerBounds = (await marker.boundingBox())!;
  expect(markerBounds.y + markerBounds.height).toBeLessThanOrEqual(scrollBounds.y + scrollBounds.height + 1);
  await marker.click();
  await expect(output).toContainText('"time":1');
  await dialog.getByRole("checkbox", { name: "Enabled" }).press("Space");
  await dialog.getByRole("button", { name: "Calm", exact: true }).click();
  await surface.getByRole("menuitemradio", { name: "Bright", exact: true }).click();
  await expect(output).toContainText('"enabled":false');
  await expect(output).toContainText('"treatment":"bright"');
  await expect(second.frameLocator("iframe").locator("[data-parameters-preview]")).toContainText('"amount":2');
  await dialog.getByRole("button", { name: "Reset parameters" }).click();
  await expect(output).toContainText('"amount":2');
  await page.keyboard.press("Escape");
  await first.getByRole("button", { name: "Theme for" }).click();
  await surface.getByRole("menuitem", { name: "Prompt Dark", exact: true }).click();
  await expect(document.getByRole("textbox", { name: "Frame draft" })).toHaveValue("Keep this input");
  // Two ordinary host patches can arrive in one React batch while playback is active.
  await first.locator("iframe").evaluate((frame) => {
    const target = frame as HTMLIFrameElement;
    for (const args of [{ amount: 7 }, { time: 1.5 }])
      target.contentWindow!.postMessage(
        { protocol: "pstdio.canvas.preview", nonce: target.dataset.testNonce, type: "args", args },
        "*",
      );
  });
  await expect(output).toContainText('"amount":7');
  await expect(output).toContainText('"time":1.5');
  await expect(document.getByRole("textbox", { name: "Frame draft" })).toHaveValue("Keep this input");
  await timeline.getByRole("button", { name: "Midpoint", exact: true }).click();
  await expect(output).toContainText('"time":1');
  await second.locator("[data-canvas-select]").click();
  await expect(dialog).toBeVisible();
  await expect(surface.locator("[data-frame-playback]:visible")).toContainText("0:00:00 / 0:02:00");
  await first.locator("[data-canvas-select]").click();
  await expect(surface.locator("[data-frame-playback]:visible")).toContainText("0:01:00 / 0:02:00");
  await timeline.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => JSON.parse((await output.textContent())!).time).toBeGreaterThan(1);
  await timeline.getByRole("button", { name: "Pause", exact: true }).click();
  await timeline.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(output).toContainText('"time":0');
  await expect(dialog.getByRole("checkbox", { name: "Loop", exact: true })).toHaveCount(0);
  await timeline.getByRole("button", { name: "Animation settings", exact: true }).click();
  const settings = surface.getByRole("dialog", { name: "Animation settings", exact: true });
  const loopStart = settings.getByText("Loop start", { exact: true }).locator("../..").getByRole("spinbutton");
  await loopStart.fill("0.5");
  await loopStart.press("Tab");
  await expect(timeline.getByRole("slider", { name: "Loop start", exact: true })).toHaveAttribute(
    "aria-valuenow",
    "0.5",
  );
  await page.keyboard.press("Escape");
  await timeline.getByRole("button", { name: "Midpoint", exact: true }).click();
  await timeline.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(output).toContainText('"time":0.5');
  const startHandle = timeline.getByRole("slider", { name: "Loop start", exact: true });
  const endHandle = timeline.getByRole("slider", { name: "Loop end", exact: true });
  await startHandle.press("ArrowRight");
  expect(Number(await startHandle.getAttribute("aria-valuenow"))).toBeGreaterThan(0.5);
  await endHandle.press("ArrowLeft");
  expect(Number(await endHandle.getAttribute("aria-valuenow"))).toBeLessThan(2);
  await timeline.getByRole("button", { name: "Animation settings", exact: true }).click();
  const loopEnd = settings.getByText("Loop end", { exact: true }).locator("../..").getByRole("spinbutton");
  await loopEnd.fill("1.5");
  await loopEnd.press("Tab");
  await expect(endHandle).toHaveAttribute("aria-valuenow", "1.5");
  await page.keyboard.press("Escape");
  await startHandle.press("Home");
  await endHandle.press("End");
  await expect(startHandle).toHaveAttribute("aria-valuenow", "0");
  await expect(endHandle).toHaveAttribute("aria-valuenow", "2");
  await surface.locator('[data-canvas-item="Still"]').locator("[data-canvas-select]").click();
  await expect(dialog).toBeVisible();
  await expect(timeline).toHaveCount(0);
  await expect(surface.getByRole("button", { name: "Open animation timeline", exact: true })).toHaveCount(0);
  await first.locator("[data-canvas-select]").click();
  await expect(timeline).toHaveAttribute("aria-label", "Animations · First");
  await first.getByRole("button", { name: "Move First", exact: true }).press("ArrowRight");
  await expect(document.getByRole("textbox", { name: "Frame draft" })).toHaveValue("Keep this input");
  await surface.locator("[data-canvas-viewport]").focus();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(surface.getByRole("button", { name: /^Open (frame parameters|animation timeline)$/ })).toHaveCount(0);
  await expect(menu.getByRole("spinbutton")).toHaveCount(0);
  await expect(timeline).toHaveCount(0);
  await expect(surface.locator("[data-ui-canvas-error]")).toHaveCount(0);
});

// Critical: scrubbing must not animate a shader layer whose speed is zero.
test("zero-speed shader layers stay stationary while the frame seeks", async ({ page }) => {
  await page.goto("/?frame=design%2Fshaders%2Fsection-hatch%2Fshader.canvas.tsx%23Preview");
  const shell = page.frameLocator("[data-verification-host]");
  const panel = shell.locator("[data-canvas-item]");
  const frame = panel.frameLocator("iframe");
  await expect(panel.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await panel.locator("[data-canvas-select]").click();
  const editor = shell.getByRole("complementary", { name: "Frame editor" });
  const drift = shell
    .getByRole("complementary", { name: "Frame editor" })
    .getByText("Pattern: Drift", { exact: true })
    .locator("../..")
    .getByRole("spinbutton");
  await drift.fill("0");
  await drift.press("Tab");
  const hatch = frame.locator('[data-motion="noise-counter hatch"]').first();
  await expect
    .poll(() =>
      hatch.evaluate((element) =>
        element
          .getAnimations()
          .some(
            (animation) =>
              (animation as CSSAnimation).animationName.includes("hatch-") &&
              (animation as CSSAnimation).animationName.endsWith("-stationary"),
          ),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  const initial = await hatch.evaluate((element) => getComputedStyle(element).transform);
  await shell.getByRole("slider", { name: "Timeline playhead", exact: true }).press("ArrowRight");
  await expect(shell.locator("[data-frame-playback]")).not.toContainText("0:00:00 / 0:30:00");
  await expect(hatch).toHaveCSS("transform", initial);
  // Critical: essential save/version actions remain reachable in a narrow Canvas view.
  await page.setViewportSize({ width: 400, height: 900 });
  for (const name of ["Save as new version", "Delete version"]) {
    const action = editor.getByRole("button", { name, exact: true });
    await action.scrollIntoViewIfNeeded();
    const bounds = (await editor.boundingBox())!;
    const button = (await action.boundingBox())!;
    expect(button.x + button.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  }
});
