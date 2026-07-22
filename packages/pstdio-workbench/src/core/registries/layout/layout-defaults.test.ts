import { describe, expect, test } from "bun:test";
import { type createDefaultWorkbenchLayout, mergeWithDefaultRegions, type WorkbenchRegionState } from "./layout-types";

describe("mergeWithDefaultRegions", () => {
  test("fills missing regions in a current persisted layout", () => {
    const widget = { widgetId: "terminals", contributionId: "terminals" };
    const region = (id: string, widgets: unknown[] = []): WorkbenchRegionState =>
      ({ id, visible: true, widgets }) as unknown as WorkbenchRegionState;

    const persisted = {
      regions: {
        main: region("main", [widget]),
      },
    } as unknown as ReturnType<typeof createDefaultWorkbenchLayout>;

    const merged = mergeWithDefaultRegions(persisted);

    expect(merged.regions.main.widgets).toEqual([widget]);
    expect(merged.regions.sidenav.id).toBe("sidenav");
    expect(merged.regions.side.id).toBe("side");
  });
});
