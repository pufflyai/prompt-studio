import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../../core";
import { createWorkbenchFileRendererInstaller } from "./install-file-renderer";

describe("workbench file renderer installation", () => {
  test("preloads the renderer view once per workbench", () => {
    const workbench = createWorkbench();
    let preloadCount = 0;
    const installFileRenderer = createWorkbenchFileRendererInstaller(() => {
      preloadCount += 1;
    });

    installFileRenderer(workbench);
    installFileRenderer(workbench);

    expect(preloadCount).toBe(1);
  });
});
