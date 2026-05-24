import { describe, expect, test } from "bun:test";
import { createDashboardResource } from "../../shared/resources";
import { resolveDashboardSessionPlacementId } from "../../shared/session/session-placement";

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
