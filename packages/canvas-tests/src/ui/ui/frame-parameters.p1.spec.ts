import { expect, test } from "@playwright/test";

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
  await expect(surface.locator('iframe[data-frame-ready="true"]')).toHaveCount(2);
  await first.locator("[data-canvas-select]").click();
  await document.getByRole("textbox", { name: "Frame draft" }).fill("Keep this input");
  await first.getByRole("button", { name: "Parameters", exact: true }).click();
  const dialog = surface.getByRole("dialog");
  await dialog.getByRole("spinbutton").fill("7");
  await dialog.getByRole("spinbutton").press("Tab");
  await expect(output).toContainText('"amount":7');
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
  await first.getByRole("button", { name: "Midpoint", exact: true }).click();
  await expect(output).toContainText('"time":1');
  await first.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => JSON.parse((await output.textContent())!).time).toBeGreaterThan(1);
  await first.getByRole("button", { name: "Pause", exact: true }).click();
  await first.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(output).toContainText('"time":0');
  await first.getByRole("button", { name: "Move First", exact: true }).press("ArrowRight");
  await expect(document.getByRole("textbox", { name: "Frame draft" })).toHaveValue("Keep this input");
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
  await panel.getByRole("button", { name: "Parameters", exact: true }).click();
  const drift = shell
    .getByRole("dialog")
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
  await panel.getByRole("slider", { name: "Time", exact: true }).press("PageUp");
  await expect(panel.locator("[data-frame-playback]")).not.toContainText("0.00 / 30.00");
  await expect(hatch).toHaveCSS("transform", initial);
});
