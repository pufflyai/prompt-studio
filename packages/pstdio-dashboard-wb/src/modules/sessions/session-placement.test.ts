import { describe, expect, test } from "bun:test";
import { resolveDashboardSessionPlacementId } from "@/modules/sessions/data/session-placement";
import { createDashboardResource } from "@/shared/app/resources";

describe("resolveDashboardSessionPlacementId", () => {
  test("uses the session resource id when the placement has a resource", () => {
    const resource = createDashboardResource("session", "session-live", "Live session", "MessageCircle");

    expect(resolveDashboardSessionPlacementId({ resource })).toBe("session-live");
  });

  test("uses the persisted session resource uri when the resource is not hydrated", () => {
    expect(
      resolveDashboardSessionPlacementId({
        resourceUri: "dashboard-workbench://session/session-restored",
      }),
    ).toBe("session-restored");
  });

  test("ignores non-session placements", () => {
    expect(
      resolveDashboardSessionPlacementId({
        resourceUri: "dashboard-workbench://dashboard-view/sessions",
      }),
    ).toBeUndefined();
  });
});
