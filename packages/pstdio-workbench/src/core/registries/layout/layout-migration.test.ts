import { describe, expect, test } from "bun:test";
import { type createDefaultWorkbenchLayout, mergeWithDefaultAreas, type WorkbenchAreaState } from "./layout-types";

// Persisted layouts written before the area rename carry the old keys. mergeWithDefaultAreas
// must remap them so a stored layout keeps its widgets instead of silently orphaning them.
describe("mergeWithDefaultAreas migration", () => {
  test("remaps renamed area ids (key and id) from a pre-rename persisted layout", () => {
    const widget = { widgetId: "terminals", contributionId: "terminals" };
    const oldArea = (id: string, widgets: unknown[] = []): WorkbenchAreaState =>
      ({ id, visible: true, widgets }) as unknown as WorkbenchAreaState;

    // A layout as it would have been persisted under the old ids, including the now-removed
    // headerless-region header areas.
    const persisted = {
      areas: {
        top: oldArea("top"),
        activityBar: oldArea("activityBar"),
        "main-bottom": oldArea("main-bottom", [widget]),
        "main-bottom-header": oldArea("main-bottom-header"),
        "main-left-header": oldArea("main-left-header"),
        "main-right-header": oldArea("main-right-header"),
        main: oldArea("main"),
      },
    } as unknown as ReturnType<typeof createDefaultWorkbenchLayout>;

    const merged = mergeWithDefaultAreas(persisted);

    // Old keys are gone; widgets survive under the renamed keys with a corrected id.
    expect((merged.areas as Record<string, unknown>)["main-bottom"]).toBeUndefined();
    expect(merged.areas.secondary.widgets).toHaveLength(1);
    expect(merged.areas.secondary.id).toBe("secondary");
    expect(merged.areas.nav.id).toBe("nav");
    expect(merged.areas.activity.id).toBe("activity");
    expect(merged.areas["secondary-header"].id).toBe("secondary-header");
    // The removed side-region header areas are dropped entirely.
    expect((merged.areas as Record<string, unknown>)["main-left-header"]).toBeUndefined();
    expect((merged.areas as Record<string, unknown>)["main-right-header"]).toBeUndefined();
    // Untouched areas keep their id; defaults fill in areas the old layout lacked.
    expect(merged.areas.main.id).toBe("main");
    expect(merged.areas.floating.id).toBe("floating");
  });
});
