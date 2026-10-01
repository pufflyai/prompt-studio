import { expect, test } from "bun:test";
import type { LayoutPersistenceAdapter } from "./registries/layout/layout-model-types";
import type { WorkbenchLayout } from "./registries/layout/layout-types";
import { createWorkbench } from "./workbench-core";

test.each([false, true])("saves pending layouts before disposal (release hook: %s)", async (releaseHook) => {
  let stored: WorkbenchLayout | undefined;
  let pending: WorkbenchLayout | undefined;
  const adapter: LayoutPersistenceAdapter = {
    getLayout: () => stored,
    setLayout: (layout) => {
      pending = layout;
    },
    flush: () => {
      stored = pending;
      pending = undefined;
    },
  };
  if (releaseHook) {
    adapter.dispose = () => {
      pending = undefined;
    };
  }
  const workbench = createWorkbench({ layoutPersistence: adapter, initialSidePanelMode: "closed" });
  workbench.sidePanel.setMode("attached");

  await workbench.dispose();

  expect(stored?.regions.side).toMatchObject({ visible: true, presentation: "attached" });
});
