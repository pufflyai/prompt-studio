import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  readAverageImageLuminance,
  readImageSvg,
  readScale,
  readTransform,
  startStorybook,
  storyUrl,
} from "./mermaid-renderer-storybook";

const defaultStoryId = "patterns-editors-mermaid-renderer--default";
const invalidStoryId = "patterns-editors-mermaid-renderer--invalid-syntax";
const readOnlyStoryId = "patterns-editors-mermaid-renderer--read-only";
const sourceChangeStoryId = "patterns-editors-mermaid-renderer--source-change-reset";
const themeToggleStoryId = "patterns-editors-mermaid-renderer--theme-toggle";
const markdownEditorMermaidStoryId = "patterns-editors-markdown-editor--mermaid-edit-preview-workflow";

declare global {
  interface Window {
    __lastMermaidCanvasSize?: { width: number; height: number };
  }
}

test.describe("mermaid renderer storybook", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(defaultStoryId));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("mermaid renderer story supports zoom-gated pan, windowed overlay, and PNG export", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(message.text());
      }
    });

    await page.goto(storyUrl(baseUrl, defaultStoryId));

    const renderedImage = page.getByRole("img", { name: "Mermaid diagram" }).first();
    await expect(renderedImage).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => renderedImage.evaluate((node) => (node instanceof HTMLImageElement ? node.naturalWidth : 0)))
      .toBeGreaterThan(0);
    expect(await readImageSvg(renderedImage)).toContain("<br");

    const inlineToolbar = page.getByTestId("mermaid-inline-toolbar");
    await expect(inlineToolbar.getByRole("button")).toHaveCount(2);
    await expect(inlineToolbar.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(inlineToolbar.getByRole("button", { name: "Open diagram" })).toBeVisible();
    await expect(page.getByLabel("Zoom percentage")).toHaveCount(0);
    await expect(page.getByText(/100%/)).toHaveCount(0);

    const zoomControls = page.getByTestId("mermaid-zoom-controls").first();
    const zoomInButton = zoomControls.getByRole("button", { name: "Zoom in" });
    const zoomOutButton = zoomControls.getByRole("button", { name: "Zoom out" });
    const zoomInBox = await zoomInButton.boundingBox();
    const zoomOutBox = await zoomOutButton.boundingBox();
    expect(zoomInBox?.y).toBeLessThan(zoomOutBox?.y ?? 0);

    const transform = page.getByTestId("mermaid-diagram-transform").first();
    const surface = page.getByTestId("mermaid-diagram-surface").first();
    const defaultTransform = await readTransform(transform);
    await expect(surface).toHaveCSS("max-height", "420px");
    await expect(transform).toHaveAttribute("data-pan-enabled", "false");
    await expect(transform).toHaveCSS("cursor", "default");

    const surfaceBox = await surface.boundingBox();
    expect(surfaceBox).toBeTruthy();
    await page.mouse.move(surfaceBox!.x + surfaceBox!.width / 2, surfaceBox!.y + surfaceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(surfaceBox!.x + surfaceBox!.width / 2 + 80, surfaceBox!.y + surfaceBox!.height / 2 + 24);
    await page.mouse.up();
    expect(await readTransform(transform)).toBe(defaultTransform);

    const defaultScale = await readScale(transform);
    await zoomInButton.click();
    await expect(transform).toHaveAttribute("data-pan-enabled", "true");
    await expect.poll(() => readScale(transform)).toBeGreaterThan(defaultScale);

    const zoomedTransform = await readTransform(transform);
    await expect(transform).toHaveCSS("cursor", "grab");
    await page.mouse.move(surfaceBox!.x + surfaceBox!.width / 2, surfaceBox!.y + surfaceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(surfaceBox!.x + surfaceBox!.width / 2 + 80, surfaceBox!.y + surfaceBox!.height / 2 + 24);
    await page.mouse.up();
    expect(await readTransform(transform)).not.toBe(zoomedTransform);

    await inlineToolbar.getByRole("button", { name: "Open diagram" }).click();
    const dialog = page.getByRole("dialog", { name: "Mermaid diagram" });
    await expect(dialog).toBeVisible();
    const viewport = page.viewportSize();
    const dialogBox = await dialog.boundingBox();
    expect(viewport).toBeTruthy();
    expect(dialogBox).toBeTruthy();
    expect(dialogBox!.width).toBeLessThan(viewport!.width);
    expect(dialogBox!.height).toBeLessThan(viewport!.height);
    expect(dialogBox!.x).toBeGreaterThan(0);
    expect(dialogBox!.y).toBeGreaterThan(0);

    const overlayHeader = page.getByTestId("mermaid-fullscreen-header");
    await expect(overlayHeader.getByRole("button", { name: "Download as PNG" })).toBeVisible();
    await expect(overlayHeader.getByRole("button", { name: "Close" })).toBeVisible();
    const overlayBody = page.getByTestId("mermaid-fullscreen-body");
    await expect(overlayBody.getByTestId("mermaid-zoom-controls")).toBeVisible();

    const headerBox = await overlayHeader.boundingBox();
    const bodyBox = await overlayBody.boundingBox();
    expect(headerBox).toBeTruthy();
    expect(bodyBox).toBeTruthy();
    expect(bodyBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);

    const overlaySurface = overlayBody.getByTestId("mermaid-diagram-surface");
    const overlayTransform = overlayBody.getByTestId("mermaid-diagram-transform");
    const overlayImage = overlayBody.getByRole("img", { name: "Mermaid diagram" });
    await expect(overlayTransform).toHaveAttribute("data-pan-enabled", "true");
    await expect(overlayTransform).toHaveCSS("cursor", "grab");

    // The Chakra dialog runs an opening transform animation; wait for the surface
    // to settle at its final laid-out width before measuring overflow.
    await expect
      .poll(async () => {
        const box = await overlaySurface.boundingBox();
        const offsetWidth = await overlaySurface.evaluate((el) => (el as HTMLElement).offsetWidth);
        return box && Math.abs(box.width - offsetWidth) < 0.5 ? "stable" : "transitioning";
      })
      .toBe("stable");

    const overlaySurfaceBox = await overlaySurface.boundingBox();
    const overlayImageBox = await overlayImage.boundingBox();
    expect(overlaySurfaceBox).toBeTruthy();
    expect(overlayImageBox).toBeTruthy();
    expect(overlayImageBox!.x).toBeGreaterThanOrEqual(overlaySurfaceBox!.x - 1);
    expect(overlayImageBox!.y).toBeGreaterThanOrEqual(overlaySurfaceBox!.y - 1);
    expect(overlayImageBox!.x + overlayImageBox!.width).toBeLessThanOrEqual(
      overlaySurfaceBox!.x + overlaySurfaceBox!.width + 1,
    );
    expect(overlayImageBox!.y + overlayImageBox!.height).toBeLessThanOrEqual(
      overlaySurfaceBox!.y + overlaySurfaceBox!.height + 1,
    );

    const initialOverlayTransform = await readTransform(overlayTransform);
    await page.mouse.move(
      overlaySurfaceBox!.x + overlaySurfaceBox!.width / 2,
      overlaySurfaceBox!.y + overlaySurfaceBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      overlaySurfaceBox!.x + overlaySurfaceBox!.width / 2 + 80,
      overlaySurfaceBox!.y + overlaySurfaceBox!.height / 2 + 24,
    );
    await page.mouse.up();
    expect(await readTransform(overlayTransform)).not.toBe(initialOverlayTransform);

    await page.evaluate(() => {
      window.__lastMermaidCanvasSize = undefined;
      HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
        window.__lastMermaidCanvasSize = { width: this.width, height: this.height };
        callback(new Blob(["png"], { type: "image/png" }));
      };
    });
    await overlayBody.getByRole("button", { name: "Zoom out" }).click();
    await overlayBody.getByRole("button", { name: "Zoom out" }).click();

    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await overlayHeader.getByRole("button", { name: "Download as PNG" }).click();
    const download = await downloadPromise.catch((error: Error) => {
      throw new Error(`${error.message}\nBrowser errors:\n${browserErrors.join("\n")}`);
    });
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const canvasSize = await page.evaluate(() => window.__lastMermaidCanvasSize);
    expect(canvasSize?.width).toBeLessThan(
      await renderedImage.evaluate((node) => (node instanceof HTMLImageElement ? node.naturalWidth : 0)),
    );

    await page.goto(storyUrl(baseUrl, readOnlyStoryId));
    const readOnlyToolbar = page.getByTestId("mermaid-inline-toolbar");
    await expect(readOnlyToolbar.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(readOnlyToolbar.getByRole("button", { name: "Open diagram" })).toBeVisible();

    await page.goto(storyUrl(baseUrl, invalidStoryId));
    await expect(page.getByRole("alert").getByText("Mermaid parse failed")).toBeVisible();
    await page.getByRole("button", { name: "Open diagram" }).click();
    const invalidDialog = page.getByRole("dialog", { name: "Mermaid diagram" });
    await expect(invalidDialog).toBeVisible();
    await expect(
      page.getByTestId("mermaid-fullscreen-header").getByRole("button", { name: "Download as PNG" }),
    ).toBeDisabled();

    await page.goto(storyUrl(baseUrl, sourceChangeStoryId));
    const sourceChangeTransform = page.getByTestId("mermaid-diagram-transform").first();
    await expect.poll(() => readScale(sourceChangeTransform)).toBe(1);
    await page.getByTestId("mermaid-zoom-controls").first().getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => readScale(sourceChangeTransform)).toBeGreaterThan(1);
    await page.getByRole("button", { name: "Change diagram source" }).click();
    await expect.poll(() => readScale(sourceChangeTransform)).toBe(1);
  });

  test("mermaid renderer rerenders the diagram palette when the theme changes", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, themeToggleStoryId));

    const renderedImage = page.getByRole("img", { name: "Mermaid diagram" }).first();
    await expect(renderedImage).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => renderedImage.evaluate((node) => (node instanceof HTMLImageElement ? node.naturalWidth : 0)))
      .toBeGreaterThan(0);

    const lightLuminance = await readAverageImageLuminance(renderedImage);
    const lightSvg = await readImageSvg(renderedImage);
    expect(lightLuminance).toBeGreaterThan(150);

    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
    await expect(page.getByTestId("mermaid-theme-preference")).toHaveAttribute("data-theme-preference", "pstdio-dark");
    await expect.poll(() => readImageSvg(renderedImage)).not.toBe(lightSvg);
    await expect.poll(() => readAverageImageLuminance(renderedImage)).toBeLessThan(lightLuminance - 40);
  });

  test("markdown editor Mermaid story edits source, previews it, and exports fenced markdown", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, markdownEditorMermaidStoryId));

    const renderedImage = page.getByRole("img", { name: "Mermaid diagram" }).first();
    await expect(renderedImage).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("mermaid-inline-toolbar").getByRole("button", { name: "Edit" }).click();
    const editor = page.locator("textarea");
    await expect(editor).toBeVisible();
    await editor.fill(`flowchart LR
  Edited["Edited Mermaid source"] --> Preview["Returned preview"]`);
    await page.getByRole("button", { name: "Preview" }).click();

    const updatedImage = page.getByRole("img", { name: "Mermaid diagram" }).first();
    await expect(updatedImage).toBeVisible();
    await expect.poll(() => readImageSvg(updatedImage)).toContain("Edited Mermaid source");

    const markdownOutput = page.getByTestId("markdown-editor-output");
    await expect(markdownOutput).toContainText("```mermaid");
    await expect(markdownOutput).toContainText('Edited["Edited Mermaid source"]');
    await expect(markdownOutput).toContainText("```");
  });
});
