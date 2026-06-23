import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { expect, type Locator, test } from "@playwright/test";

const defaultStoryId = "patterns-editors-mermaid-renderer--default";
const invalidStoryId = "patterns-editors-mermaid-renderer--invalid-syntax";
const readOnlyStoryId = "patterns-editors-mermaid-renderer--read-only";
const sourceChangeStoryId = "patterns-editors-mermaid-renderer--source-change-reset";
const markdownEditorMermaidStoryId = "patterns-editors-markdown-editor--mermaid-edit-preview-workflow";

declare global {
  interface Window {
    __lastMermaidCanvasSize?: { width: number; height: number };
  }
}

const getFreePort = async () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate Storybook port"));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolvePort(port);
      });
    });
  });

const waitForStorybook = async (baseUrl: string, process: ChildProcessWithoutNullStreams) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    if (process.exitCode !== null) {
      throw new Error(`Storybook exited before it became reachable with code ${process.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/iframe.html?id=${defaultStoryId}`);
      if (response.ok) {
        return;
      }
    } catch {
      // Storybook is still starting.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  throw new Error("Timed out waiting for Storybook");
};

const startStorybook = async () => {
  const port = await getFreePort();
  const repoRoot = resolve(import.meta.dirname, "../../..", "..");
  const uiRoot = resolve(repoRoot, "packages/ui");
  const baseUrl = `http://127.0.0.1:${port}`;
  const storybook = spawn(
    "bun",
    [
      "x",
      "storybook",
      "dev",
      "--config-dir",
      resolve(uiRoot, ".storybook"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--ci",
    ],
    {
      cwd: uiRoot,
      env: {
        ...process.env,
        STORYBOOK_DISABLE_TELEMETRY: "1",
      },
      stdio: "pipe",
    },
  );

  try {
    await waitForStorybook(baseUrl, storybook);
  } catch (error) {
    storybook.kill();
    throw error;
  }

  return { baseUrl, storybook };
};

const storyUrl = (baseUrl: string, storyId: string) => `${baseUrl}/iframe.html?id=${storyId}`;

const readTransform = (locator: Locator) =>
  locator.evaluate((element) => element.getAttribute("style") || getComputedStyle(element).transform || "");

const readScale = (locator: Locator) =>
  locator.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    if (transform === "none") {
      return 1;
    }

    const matrixScale = transform.match(/^matrix\(([^,]+)/);
    return matrixScale ? Number(matrixScale[1]) : 1;
  });

const readImageSvg = (locator: Locator) =>
  locator.evaluate((element) => {
    if (!(element instanceof HTMLImageElement)) {
      return "";
    }

    const dataUrl = element.src;
    const encodedSvg = dataUrl.replace(/^data:image\/svg\+xml;base64,/, "");
    return new TextDecoder().decode(Uint8Array.from(atob(encodedSvg), (character) => character.charCodeAt(0)));
  });

test.describe("mermaid renderer storybook", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook());
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("mermaid renderer story supports zoom-gated pan, fullscreen, and PNG export", async ({ page }) => {
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
    await expect(inlineToolbar.getByRole("button", { name: "Fullscreen" })).toBeVisible();
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

    await inlineToolbar.getByRole("button", { name: "Fullscreen" }).click();
    const dialog = page.getByRole("dialog", { name: "Mermaid diagram" });
    await expect(dialog).toBeVisible();
    const fullscreenHeader = page.getByTestId("mermaid-fullscreen-header");
    await expect(fullscreenHeader.getByRole("button", { name: "Download as PNG" })).toBeVisible();
    await expect(fullscreenHeader.getByRole("button", { name: "Close" })).toBeVisible();
    const fullscreenBody = page.getByTestId("mermaid-fullscreen-body");
    await expect(fullscreenBody.getByTestId("mermaid-zoom-controls")).toBeVisible();

    const fullscreenSurface = fullscreenBody.getByTestId("mermaid-diagram-surface");
    const fullscreenTransform = fullscreenBody.getByTestId("mermaid-diagram-transform");
    const fullscreenImage = fullscreenBody.getByRole("img", { name: "Mermaid diagram" });
    await expect(fullscreenTransform).toHaveAttribute("data-pan-enabled", "true");
    await expect(fullscreenTransform).toHaveCSS("cursor", "grab");

    // The Chakra dialog runs an opening transform animation; wait for the surface
    // to settle at its final laid-out width before measuring overflow.
    await expect
      .poll(async () => {
        const box = await fullscreenSurface.boundingBox();
        const offsetWidth = await fullscreenSurface.evaluate((el) => (el as HTMLElement).offsetWidth);
        return box && Math.abs(box.width - offsetWidth) < 0.5 ? "stable" : "transitioning";
      })
      .toBe("stable");

    const fullscreenSurfaceBox = await fullscreenSurface.boundingBox();
    const fullscreenImageBox = await fullscreenImage.boundingBox();
    expect(fullscreenSurfaceBox).toBeTruthy();
    expect(fullscreenImageBox).toBeTruthy();
    expect(fullscreenImageBox!.x).toBeGreaterThanOrEqual(fullscreenSurfaceBox!.x - 1);
    expect(fullscreenImageBox!.y).toBeGreaterThanOrEqual(fullscreenSurfaceBox!.y - 1);
    expect(fullscreenImageBox!.x + fullscreenImageBox!.width).toBeLessThanOrEqual(
      fullscreenSurfaceBox!.x + fullscreenSurfaceBox!.width + 1,
    );
    expect(fullscreenImageBox!.y + fullscreenImageBox!.height).toBeLessThanOrEqual(
      fullscreenSurfaceBox!.y + fullscreenSurfaceBox!.height + 1,
    );

    const initialFullscreenTransform = await readTransform(fullscreenTransform);
    await page.mouse.move(
      fullscreenSurfaceBox!.x + fullscreenSurfaceBox!.width / 2,
      fullscreenSurfaceBox!.y + fullscreenSurfaceBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      fullscreenSurfaceBox!.x + fullscreenSurfaceBox!.width / 2 + 80,
      fullscreenSurfaceBox!.y + fullscreenSurfaceBox!.height / 2 + 24,
    );
    await page.mouse.up();
    expect(await readTransform(fullscreenTransform)).not.toBe(initialFullscreenTransform);

    await page.evaluate(() => {
      window.__lastMermaidCanvasSize = undefined;
      HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
        window.__lastMermaidCanvasSize = { width: this.width, height: this.height };
        callback(new Blob(["png"], { type: "image/png" }));
      };
    });
    await fullscreenBody.getByRole("button", { name: "Zoom out" }).click();
    await fullscreenBody.getByRole("button", { name: "Zoom out" }).click();

    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await fullscreenHeader.getByRole("button", { name: "Download as PNG" }).click();
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
    await expect(readOnlyToolbar.getByRole("button", { name: "Fullscreen" })).toBeVisible();

    await page.goto(storyUrl(baseUrl, invalidStoryId));
    await expect(page.getByRole("alert").getByText("Mermaid parse failed")).toBeVisible();
    await page.getByRole("button", { name: "Fullscreen" }).click();
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
