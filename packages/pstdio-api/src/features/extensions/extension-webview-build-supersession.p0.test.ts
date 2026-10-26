import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { resolveManagedWebviewPaths } from "./extension-webviews";
import { writeExtension, writeManagedBuildOutput } from "./test-utils/webview-build-fixture";

test("cancels a superseded compiler and publishes only the latest view revision", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-supersession-"));
  const sourcePath = join(root, "extension");
  const cache = join(root, "cache");
  writeExtension(sourcePath, { main: "src/main.tsx" });
  let started!: () => void;
  const firstStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let firstSignal: AbortSignal | undefined;
  let builds = 0;
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: async () => [
      { id: "installed", install_name: "lab", source_path: sourcePath, updated_at: "2026-10-26" },
    ],
    webviewCacheRoot: cache,
    reportBuildSuccess: async () => "reported",
    reportBuildFailure: async () => "reported",
    buildWebview: async (input) => {
      builds++;
      if (builds === 1) {
        firstSignal = input.signal;
        started();
        await new Promise<void>((resolve) => {
          input.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        return { success: false, details: "cancelled" };
      }
      writeManagedBuildOutput(input);
      writeFileSync(join(input.outdir, "module.js"), "latest");
      return { success: true, details: "" };
    },
  });
  try {
    const first = manager.refresh(sourcePath);
    await firstStarted;
    writeFileSync(join(sourcePath, "src/main.tsx"), "console.log('latest');");
    const second = manager.refresh(sourcePath);
    await second;
    expect(firstSignal?.aborted).toBe(true);
    await first;
    const { distDir } = resolveManagedWebviewPaths({
      installedExtensionId: "installed",
      webviewCacheRoot: cache,
      webviewId: "pstdio.lab.view.main",
    });
    expect(readFileSync(join(distDir, "module.js"), "utf8")).toBe("latest");
  } finally {
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
