import { describe, expect, test } from "bun:test";
import { resolveDashboardLayoutPersistenceScope } from "./navigation-state";

describe("resolveDashboardLayoutPersistenceScope", () => {
  test("uses canonical resource, aggregate, and empty scopes", () => {
    expect(
      resolveDashboardLayoutPersistenceScope({
        projectId: "project-1",
        modeId: "workspace",
        resource: { kind: "workspace", uri: "dashboard-workbench://workspace/workspace-1" },
      }),
    ).toBe("project/project-1/mode/workspace/resource/dashboard-workbench://workspace/workspace-1");
    expect(
      resolveDashboardLayoutPersistenceScope({
        activeCollection: "tickets",
        modeId: "project",
        projectId: "project-1",
      }),
    ).toBe("project/project-1/mode/project/aggregate/tickets");
    expect(
      resolveDashboardLayoutPersistenceScope({
        modeId: "project",
        projectId: "project-1",
      }),
    ).toBe("project/project-1/mode/project/aggregate/empty");
    expect(resolveDashboardLayoutPersistenceScope({ modeId: "project" })).toBeUndefined();
  });
});
