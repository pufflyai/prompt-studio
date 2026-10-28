import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { createOnboardingModule } from "./module";

test("opens setup without a project", async () => {
  const state = { completed: false, hidden: false, harnesses: null, workAreas: null };
  const onboarding = createOnboardingModule({
    read: async () => ({ state, detectedHarnesses: [], platform: "linux" }),
    update: async () => state,
  });
  const workbench = createWorkbench();
  const module = workbench.registerModule(onboarding.module);
  try {
    expect(
      await onboarding.open(
        () => {},
        () => true,
      ),
    ).toBe(false);
    expect(workbench.pages.store.getState().projectId).toBeUndefined();
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
  test(`leaves startup in control while saved setup loads (${JSON.stringify(saved)})`, async () => {
    const state = { ...saved, harnesses: null, workAreas: null };
    const loaded = Promise.withResolvers<{ state: typeof state; detectedHarnesses: []; platform: string }>();
    const onboarding = createOnboardingModule({ read: () => loaded.promise, update: async () => state });
    const workbench = createWorkbench();
    const module = workbench.registerModule(onboarding.module);
    try {
      const opening = onboarding.open(
        () => {},
        () => true,
      );
      expect(workbench.modes.getActiveModeId()).toBeUndefined();
      loaded.resolve({ state, detectedHarnesses: [], platform: "linux" });
      expect(await opening).toBe(true);
      expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
      expect(workbench.modes.getActiveModeId()).toBeUndefined();
    } finally {
      module.dispose();
    }
  });
}
