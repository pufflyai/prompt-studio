import { expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  captureExtensionContributionRefreshLayout,
  restoreExtensionContributionRefreshLayout,
} from "./extension-contribution-refresh-layout";

test("does not restore a removed snapshot mode over the current mode", () => {
  const workbench = createWorkbenchCore();
  const removedMode = workbench.modes.registerMode({
    id: "removed-extension.mode",
    activate: () => undefined,
  });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.modes.setActiveMode("removed-extension.mode");
  const snapshot = captureExtensionContributionRefreshLayout(workbench);

  removedMode.dispose();
  workbench.modes.setActiveMode("project");

  expect(() => restoreExtensionContributionRefreshLayout(workbench, snapshot)).not.toThrow();
  expect(workbench.modes.getActiveModeId()).toBe("project");
});
