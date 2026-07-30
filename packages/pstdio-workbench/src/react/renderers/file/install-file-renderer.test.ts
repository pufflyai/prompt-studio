import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../../core";
import { createWorkbenchFileRendererInstaller } from "./install-file-renderer";

describe("workbench file renderer installation", () => {
  test("preloads the renderer view once per workbench", () => {
    const workbench = createWorkbenchCore();
    let preloadCount = 0;
    const installFileRenderer = createWorkbenchFileRendererInstaller(() => {
      preloadCount += 1;
    });

    installFileRenderer(workbench);
    installFileRenderer(workbench);

    expect(preloadCount).toBe(1);
  });
});
