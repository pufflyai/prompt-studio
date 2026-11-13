import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createExtensionSettingsRetirement } from "./extension-settings-authority";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata } from "./module-test-fixtures";

const panelId = "pstdio.extension-lab.settings-panel.account";
const viewId = metadata.views[0]!.id;
const accountMetadata = (title: string): WorkbenchExtensionMetadata => ({
  ...metadata,
  pages: [],
  navigationItems: [],
  views: [{ ...metadata.views[0]!, title }],
  settingsPanels: [
    {
      id: panelId,
      extensionId: "pstdio.extension-lab",
      view: { extensionId: "pstdio.extension-lab", kind: "view", id: "labPage" },
      slot: { id: "global.settingsPanels" },
    },
  ],
});

const fixture = async () => {
  const queries = createScopedQueryClient({ runtimeId: crypto.randomUUID(), accountId: "old", extensionId: "pstdio" });
  const fresh = Promise.withResolvers<WorkbenchExtensionMetadata>();
  let reads = 0;
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => {} });
  workbench.registerModule(createWorkbenchSettingsModule());
  selectDashboardProject(workbench, { id: "settings-account", name: "Account settings" });
  const registration = workbench.registerModule(
    createExtensionsModule({
      queries,
      loadAppearance: async () => emptyAppearance,
      loadMetadata: () => (++reads === 1 ? Promise.resolve(accountMetadata("Old private account")) : fresh.promise),
    }),
  );
  await flushMicrotasks();
  await workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId });
  const shell = () => workbench.layout.getLayout().regions.overlay.widgets[0];
  expect(shell()?.resource?.metadata?.panelId).toBe(panelId);
  const retire = async () => {
    queries.setAuthority({ accountId: "local" });
    await flushMicrotasks();
    expect(workbench.views.getView(viewId)).toBeUndefined();
    expect(workbench.settings.getPanel(panelId)).toBeUndefined();
  };
  return {
    workbench,
    queries,
    shell,
    fresh,
    retire,
    async close() {
      fresh.resolve(accountMetadata("Fresh signed-out account"));
      registration.dispose();
      queries.dispose();
      await workbench.dispose();
    },
  };
};

test("account retirement purges old settings data and preserves only the selected global panel intent", async () => {
  const f = await fixture();
  try {
    await f.retire();
    expect(f.shell()?.resource).toEqual({ type: "workbench-settings", id: panelId, metadata: { panelId } });
    expect(f.shell()?.title).not.toContain("Old private account");
    f.fresh.resolve(accountMetadata("Fresh signed-out account"));
    await flushMicrotasks();
    expect(f.shell()?.resource?.metadata?.panelId).toBe(panelId);
    expect(f.shell()?.resource?.label).toBe("Fresh signed-out account");
    expect(f.workbench.views.getView(viewId)?.title).toBe("Fresh signed-out account");
  } finally {
    await f.close();
  }
});

test("closing settings during a held account catalog is authoritative", async () => {
  const f = await fixture();
  try {
    await f.retire();
    f.workbench.overlays.closeOverlay(f.shell()!.widgetId);
    f.fresh.resolve(accountMetadata("Fresh signed-out account"));
    await flushMicrotasks();
    expect(f.shell()).toBeUndefined();
  } finally {
    await f.close();
  }
});

test("choosing another settings panel during account replacement keeps the newer destination", async () => {
  const f = await fixture();
  try {
    f.workbench.settings.registerPanel({
      id: "runtime",
      title: "Runtime",
      scope: "global",
      kind: "schema",
      preferences: [],
    });
    await f.retire();
    await f.workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "runtime" });
    f.fresh.resolve(accountMetadata("Fresh signed-out account"));
    await flushMicrotasks();
    expect(f.shell()?.resource?.metadata?.panelId).toBe("runtime");
  } finally {
    await f.close();
  }
});

for (const change of ["removed", "project-only"] as const) {
  test(`a fresh catalog with the global panel ${change} cannot restore its old destination`, async () => {
    const f = await fixture();
    try {
      await f.retire();
      const next = accountMetadata("Fresh signed-out account");
      next.settingsPanels =
        change === "removed"
          ? []
          : next.settingsPanels!.map((panel) => ({ ...panel, slot: { id: "project.settingsPanels" } }));
      f.fresh.resolve(next);
      await flushMicrotasks();
      expect(f.shell()).toBeUndefined();
    } finally {
      await f.close();
    }
  });
}

test("changing projects retires a held settings intent before its former catalog settles", async () => {
  const f = await fixture();
  try {
    await f.retire();
    selectDashboardProject(f.workbench, { id: "another-project", name: "Another project" });
    f.fresh.resolve(accountMetadata("Fresh signed-out account"));
    await flushMicrotasks();
    expect(f.shell()).toBeUndefined();
  } finally {
    await f.close();
  }
});

test("logout can retire account and removed-project owners before the fresh global settings catalog settles", async () => {
  const f = await fixture();
  try {
    await f.retire();
    f.queries.clearScope({ projectId: "settings-account" });
    await flushMicrotasks();
    expect(f.shell()?.resource).toEqual({ type: "workbench-settings", id: panelId, metadata: { panelId } });
    f.fresh.resolve(accountMetadata("Fresh signed-out account"));
    await flushMicrotasks();
    expect(f.shell()?.resource?.label).toBe("Fresh signed-out account");
  } finally {
    await f.close();
  }
});

for (const action of ["close", "navigate", "dispose"] as const) {
  test(`a synchronous ${action} during settings retirement cannot be overwritten by the old intent`, async () => {
    const f = await fixture();
    const pending = createExtensionSettingsRetirement(f.workbench);
    try {
      f.workbench.settings.registerPanel({
        id: "runtime",
        title: "Runtime",
        scope: "global",
        kind: "schema",
        preferences: [],
      });
      pending.retire(() => {
        if (action === "dispose") pending.dispose();
        else if (action === "close") f.workbench.overlays.closeOverlay(f.shell()!.widgetId);
        else
          f.workbench.overlays.openOverlay("workbench.settings", {
            resource: { type: "workbench-settings", id: "runtime", metadata: { panelId: "runtime" } },
          });
      });
      pending.complete();
      if (action === "navigate") expect(f.shell()?.resource?.metadata?.panelId).toBe("runtime");
      else expect(f.shell()).toBeUndefined();
    } finally {
      pending.dispose();
      await f.close();
    }
  });
}
