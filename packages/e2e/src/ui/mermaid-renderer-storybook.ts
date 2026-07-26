import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

const STORYBOOK_BOOT_TIMEOUT_MS = 60_000;

// Storybook compiles the package from source on boot, which on a loaded machine outruns
// Playwright's default 30s hook timeout. Without this the hook is killed mid-boot and the
// whole describe block fails on a spec that never ran.
const STORYBOOK_BOOT_HOOK_TIMEOUT_MS = STORYBOOK_BOOT_TIMEOUT_MS + 30_000;

// A story's first render pays Storybook's on-demand compile on top of the page load: the boot
// probe only fetches iframe.html, so the whole Vite compile lands on the first render gate.
// 30s was not enough on CI — ps-178 and ps-193 both burned it with zero elements on the same
// run, and the same workbench story renders in ~9s locally. Every story spec is test.slow()
// (90s), which leaves room for the interactions that follow.
export const STORY_RENDER_TIMEOUT_MS = 60_000;

type StorybookPreview = { storyRenders?: Array<{ phase?: string }> };

// A story's `play` function keeps driving the DOM after the story is on screen, and Storybook
// only marks the render "finished" once it returns. A spec that starts interacting before then
// races the play function over the same elements — on a loaded runner the play function's
// trailing keystrokes land in the middle of the spec's own interaction. Playback covers the
// same compile the render gate waits for, so it shares that budget; measured at 22.9s for the
// preview-tabs story under 20x CPU throttling.
export const waitForStoryPlayback = async (page: Page) => {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as { __STORYBOOK_PREVIEW__?: StorybookPreview }
            ).__STORYBOOK_PREVIEW__?.storyRenders?.map((render) => render.phase) ?? [],
        ),
      { timeout: STORY_RENDER_TIMEOUT_MS },
    )
    .toEqual(["finished"]);
};

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

const waitForStorybook = async (baseUrl: string, process: ChildProcessWithoutNullStreams, probeStoryId: string) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STORYBOOK_BOOT_TIMEOUT_MS) {
    if (process.exitCode !== null) {
      throw new Error(`Storybook exited before it became reachable with code ${process.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/iframe.html?id=${probeStoryId}`);
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

export const startStorybook = async (
  probeStoryId: string,
  packageName: "ui" | "pstdio-dashboard" | "pstdio-workbench" = "ui",
) => {
  test.setTimeout(STORYBOOK_BOOT_HOOK_TIMEOUT_MS);

  const port = await getFreePort();
  const repoRoot = resolve(import.meta.dirname, "../../..", "..");
  const packageRoot = resolve(repoRoot, "packages", packageName);
  const baseUrl = `http://127.0.0.1:${port}`;
  const storybook = spawn(
    "bun",
    [
      "x",
      "storybook",
      "dev",
      "--config-dir",
      resolve(packageRoot, ".storybook"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--ci",
    ],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        STORYBOOK_DISABLE_TELEMETRY: "1",
      },
      stdio: "pipe",
    },
  );

  try {
    await waitForStorybook(baseUrl, storybook, probeStoryId);
  } catch (error) {
    storybook.kill();
    throw error;
  }

  return { baseUrl, storybook };
};

export const storyUrl = (baseUrl: string, storyId: string) => `${baseUrl}/iframe.html?id=${storyId}`;

export const readTransform = (locator: Locator) =>
  locator.evaluate((element) => element.getAttribute("style") || getComputedStyle(element).transform || "");

export const readScale = (locator: Locator) =>
  locator.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    if (transform === "none") {
      return 1;
    }

    const matrixScale = transform.match(/^matrix\(([^,]+)/);
    return matrixScale ? Number(matrixScale[1]) : 1;
  });

export const readImageSvg = (locator: Locator) =>
  locator.evaluate((element) => {
    if (!(element instanceof HTMLImageElement)) {
      return "";
    }

    const dataUrl = element.src;
    const encodedSvg = dataUrl.replace(/^data:image\/svg\+xml;base64,/, "");
    return new TextDecoder().decode(Uint8Array.from(atob(encodedSvg), (character) => character.charCodeAt(0)));
  });

export const readAverageImageLuminance = (locator: Locator) =>
  locator.evaluate(async (element) => {
    if (!(element instanceof HTMLImageElement) || element.naturalWidth === 0 || element.naturalHeight === 0) {
      return 255;
    }

    await element.decode().catch(() => undefined);

    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return 255;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(element, 0, 0);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = Math.max(1, Math.floor(pixels.length / 4 / 25_000));
    let luminance = 0;
    let samples = 0;

    for (let index = 0; index < pixels.length; index += 4 * stride) {
      luminance += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      samples += 1;
    }

    return luminance / samples;
  });
