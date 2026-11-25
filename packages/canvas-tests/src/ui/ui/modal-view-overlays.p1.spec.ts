import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const frame = "packages/ui/src/utils/scoped-overlays-modal-view.canvas.tsx#RetainedView";

// Critical: a retained view's popup must not remain over the destination inside an open modal.
test("a reopened popup takes Escape before its retained modal", async ({ page }) => {
  const preview = await openCanvasPreview(page, frame);
  const dialog = preview.getByRole("dialog", { name: "Retained modal", exact: true });
  const draft = dialog.getByRole("textbox", { name: "Modal draft", exact: true });
  await draft.fill("Keep my modal draft");
  const trigger = dialog.getByRole("button", { name: "Modal options", exact: true });
  const popup = preview.getByRole("dialog", { name: "Modal options", exact: true });
  await trigger.click();
  await expect(popup).toBeVisible();
  // Navigation originates inside the popup, so no outside pointer-down dismisses it first.
  await popup.getByRole("button", { name: "Next view from options", exact: true }).click();
  await expect(dialog.getByText("Second modal view", { exact: true })).toBeVisible();
  await expect(popup).toBeHidden();
  await dialog.getByRole("button", { name: "First view", exact: true }).click();
  await expect(draft).toHaveValue("Keep my modal draft");
  await expect(popup).toBeHidden();
  // Hold animation frames from the reopening click until the Escape keydown has reached the page.
  const resumeAnimationFrames = await trigger.evaluateHandle((element) => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    const requestFrame = window.requestAnimationFrame;
    const cancelFrame = window.cancelAnimationFrame;
    element.addEventListener(
      "click",
      () => {
        window.requestAnimationFrame = (callback) => {
          const id = --nextId;
          callbacks.set(id, callback);
          return id;
        };
        window.cancelAnimationFrame = (id) => {
          if (id < 0) callbacks.delete(id);
          else cancelFrame(id);
        };
      },
      { capture: true, once: true },
    );
    return () => {
      window.requestAnimationFrame = requestFrame;
      window.cancelAnimationFrame = cancelFrame;
      for (const callback of callbacks.values()) requestFrame(callback);
    };
  });
  try {
    await trigger.click();
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  } finally {
    await resumeAnimationFrames.evaluate((resume) => resume());
    await resumeAnimationFrames.dispose();
  }
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(dialog).toBeVisible();
  await expect(draft).toHaveValue("Keep my modal draft");
  await trigger.press("Escape");
  await expect(dialog).toBeHidden();
});

// Critical: a deeper dialog keeps popup interaction and focus inside its own modal owner.
test("a deeper dialog keeps its popup owner inside a retained modal view", async ({ page }) => {
  const preview = await openCanvasPreview(page, frame);
  await preview.getByRole("button", { name: "Open nested modal", exact: true }).click();
  const nested = preview.getByRole("dialog", { name: "Nested modal", exact: true });
  const trigger = nested.getByRole("button", { name: "Nested options", exact: true });
  await trigger.click();
  const popup = preview.getByRole("dialog", { name: "Nested options", exact: true });
  await popup.getByRole("button", { name: "Keep nested choice", exact: true }).click();
  await expect(nested.getByText("Nested choice kept", { exact: true })).toBeVisible();
  await popup.press("Escape");
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
  await nested.getByRole("button", { name: "Back to retained modal", exact: true }).click();
  await expect(nested).toBeHidden();
  await expect(preview.getByRole("dialog", { name: "Retained modal", exact: true })).toBeVisible();
});

// Critical: a whole surface inside a modal must hide its popup without discarding unfinished work.
test("a modal-contained surface suspends its popup and preserves its draft", async ({ page }) => {
  const preview = await openCanvasPreview(page, frame);
  const dialog = preview.getByRole("dialog", { name: "Retained modal", exact: true });
  const trigger = dialog.getByRole("button", { name: "Surface options", exact: true });
  const popup = preview.getByRole("dialog", { name: "Surface options", exact: true });
  await trigger.click();
  const draft = popup.getByRole("textbox", { name: "Surface popup draft", exact: true });
  await draft.fill("Keep this unfinished popup");
  await popup.getByRole("button", { name: "Suspend nested surface", exact: true }).click();
  await expect(popup).toBeHidden();
  await dialog.getByRole("button", { name: "Restore nested surface", exact: true }).click();
  await expect(popup).toBeVisible();
  await expect(draft).toHaveValue("Keep this unfinished popup");
  await popup.press("Escape");
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
});

// Critical: a preference-only provider must preserve keyboard access inside the enclosing dialog.
test("a provider without a surface root keeps popup choices inside its dialog", async ({ page }) => {
  const preview = await openCanvasPreview(page, frame);
  const dialog = preview.getByRole("dialog", { name: "Retained modal", exact: true });
  const trigger = dialog.getByRole("button", { name: "Preference options", exact: true });
  await trigger.press("Enter");
  const choice = dialog.getByRole("button", { name: "Keep preference", exact: true });
  await expect(choice).toBeFocused();
  await choice.press("Enter");
  await expect(dialog.getByText("Preference kept", { exact: true })).toBeVisible();
  await choice.press("Escape");
  await expect(preview.getByRole("dialog", { name: "Preference options", exact: true })).toBeHidden();
  await expect(trigger).toBeFocused();
});
