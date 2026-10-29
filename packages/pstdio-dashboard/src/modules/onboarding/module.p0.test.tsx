import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createOnboardingModule } from "./module";

for (const completed of [false, true]) {
  test(`opens setup for a newly created project with completed=${completed}`, async () => {
    const state = { completed, hidden: false, harnesses: null, workAreas: null };
    const onboarding = createOnboardingModule({
      read: async () => ({ state, installedExtensions: [], detectedHarnesses: [], platform: "linux" }),
      update: async () => state,
    });
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
    workbench.modes.setActiveMode("project");
    const module = workbench.registerModule(onboarding.module);
    try {
      await onboarding.open("project-1");
      expect(workbench.modes.getActiveModeId()).toBe("project");
      expect(workbench.layout.getActivePanel("overlay")?.viewId).toBe("dashboard.onboarding.setup");
    } finally {
      module.dispose();
    }
  });
}

test("keeps the created project open when onboarding is hidden", async () => {
  const state = { completed: true, hidden: true, harnesses: null, workAreas: null };
  const loaded = Promise.withResolvers<{
    state: typeof state;
    installedExtensions: [];
    detectedHarnesses: [];
    platform: string;
  }>();
  const onboarding = createOnboardingModule({ read: () => loaded.promise, update: async () => state });
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
  workbench.modes.setActiveMode("project");
  const module = workbench.registerModule(onboarding.module);
  try {
    const opening = onboarding.open("project-1");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    loaded.resolve({ state, installedExtensions: [], detectedHarnesses: [], platform: "linux" });
    await opening;
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    expect(workbench.modes.getActiveModeId()).toBe("project");
  } finally {
    module.dispose();
  }
});

test("keeps setup tied to the project whose creation requested it", async () => {
  const state = { completed: false, hidden: false, harnesses: null, workAreas: null };
  const loaded = Promise.withResolvers<{
    state: typeof state;
    installedExtensions: [];
    detectedHarnesses: [];
    platform: string;
  }>();
  const onboarding = createOnboardingModule({ read: () => loaded.promise, update: async () => state });
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
  workbench.modes.setActiveMode("project");
  const module = workbench.registerModule(onboarding.module);
  try {
    const opening = onboarding.open("project-1");
    selectDashboardProject(workbench, { id: "project-2", name: "Tasks" });
    loaded.resolve({ state, installedExtensions: [], detectedHarnesses: [], platform: "linux" });
    await opening;
    expect(workbench.modes.getActiveModeId()).toBe("project");
  } finally {
    module.dispose();
  }
});

test("closes project setup when the selected project changes", async () => {
  const state = { completed: false, hidden: false, harnesses: null, workAreas: null };
  const onboarding = createOnboardingModule({
    read: async () => ({ state, installedExtensions: [], detectedHarnesses: [], platform: "linux" }),
    update: async () => state,
  });
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
  workbench.modes.setActiveMode("project");
  const module = workbench.registerModule(onboarding.module);
  try {
    await onboarding.open("project-1");
    expect(workbench.layout.getActivePanel("overlay")?.viewId).toBe("dashboard.onboarding.setup");
    selectDashboardProject(workbench, { id: "project-2", name: "Tasks" });
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    expect(workbench.modes.getActiveModeId()).toBe("project");
  } finally {
    module.dispose();
  }
});
