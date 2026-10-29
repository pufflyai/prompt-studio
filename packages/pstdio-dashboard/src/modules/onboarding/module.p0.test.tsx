import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createOnboardingModule } from "./module";

test("opens setup for the project just created", async () => {
  const state = { completed: false, hidden: false, harnesses: null, workAreas: null };
  const onboarding = createOnboardingModule({
    read: async () => ({ state, detectedHarnesses: [], platform: "linux" }),
    update: async () => state,
  });
  const workbench = createWorkbench();
  selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
  const module = workbench.registerModule(onboarding.module);
  try {
    await onboarding.open("project-1");
    expect(workbench.modes.getActiveModeId()).toBe("dashboard.onboarding");
    expect(workbench.layout.getActivePanel("overlay")?.viewId).toBe("dashboard.onboarding.setup");
  } finally {
    module.dispose();
  }
});

for (const saved of [
  { completed: true, hidden: false },
  { completed: false, hidden: true },
]) {
  test(`keeps the created project open while saved setup loads (${JSON.stringify(saved)})`, async () => {
    const state = { ...saved, harnesses: null, workAreas: null };
    const loaded = Promise.withResolvers<{ state: typeof state; detectedHarnesses: []; platform: string }>();
    const onboarding = createOnboardingModule({ read: () => loaded.promise, update: async () => state });
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
    workbench.modes.setActiveMode("project");
    const module = workbench.registerModule(onboarding.module);
    try {
      const opening = onboarding.open("project-1");
      expect(workbench.modes.getActiveModeId()).toBe("project");
      loaded.resolve({ state, detectedHarnesses: [], platform: "linux" });
      await opening;
      expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
      expect(workbench.modes.getActiveModeId()).toBe("project");
    } finally {
      module.dispose();
    }
  });
}

test("keeps setup tied to the project whose creation requested it", async () => {
  const state = { completed: false, hidden: false, harnesses: null, workAreas: null };
  const loaded = Promise.withResolvers<{ state: typeof state; detectedHarnesses: []; platform: string }>();
  const onboarding = createOnboardingModule({ read: () => loaded.promise, update: async () => state });
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
  workbench.modes.setActiveMode("project");
  const module = workbench.registerModule(onboarding.module);
  try {
    const opening = onboarding.open("project-1");
    selectDashboardProject(workbench, { id: "project-2", name: "Tasks" });
    loaded.resolve({ state, detectedHarnesses: [], platform: "linux" });
    await opening;
    expect(workbench.modes.getActiveModeId()).toBe("project");
  } finally {
    module.dispose();
  }
});
