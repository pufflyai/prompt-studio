import { expect, test } from "@playwright/test";
import { observeWebviewOverlayAnchor } from "@pstdio/sdk/extensions";

// Critical: floating controls must follow their trigger when the guest layout changes.
test("overlay anchors follow layout and transforms until disposal", async ({ page }) => {
  await page.setContent("<div><button>Tools</button></div>");
  await page.addScriptTag({
    content: `window.releaseAnchor=(${observeWebviewOverlayAnchor.toString()})(document.querySelector('button'),rect=>window.anchor=rect,()=>window.anchor='closed');`,
  });
  await expect.poll(() => page.evaluate("window.anchor?.width")).toBeGreaterThan(0);
  const before = await page.evaluate("window.anchor");
  await page.locator("div").evaluate((element) => {
    element.style.paddingLeft = "150px";
  });
  await expect.poll(() => page.evaluate("window.anchor.x")).toBe(before.x + 150);
  await page.getByRole("button").evaluate(async (element) => {
    await element.animate([{ transform: "translateY(0)" }, { transform: "translateY(50px)" }], {
      duration: 100,
      fill: "forwards",
    }).finished;
  });
  await expect.poll(() => page.evaluate("window.anchor.y")).toBe(before.y + 50);
  await page.getByRole("button").evaluate((element) => element.remove());
  await expect.poll(() => page.evaluate("window.anchor")).toBe("closed");
  await page.evaluate("window.releaseAnchor()");
});
