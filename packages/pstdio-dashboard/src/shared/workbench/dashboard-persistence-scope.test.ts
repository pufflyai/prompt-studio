import { describe, expect, test } from "bun:test";
import { resolveDashboardPersistenceScope } from "./dashboard-persistence-scope";

describe("dashboard persistence scope", () => {
  test("isolates each resource layout while retaining project chrome", () => {
    expect(
      resolveDashboardPersistenceScope({
        currentScope: "project/project-1/mode/workspaces/page/workspaces",
        modeId: "workspaces",
        pageId: "workspaces",
        projectId: "project-1",
        resource: {
          kind: "workspace",
          uri: "pstdio://extension-resource/workspace/workspace-1",
        },
      }),
    ).toEqual({
      scope: "project/project-1/mode/workspaces/resource/pstdio://extension-resource/workspace/workspace-1",
      carryRegions: [
        "nav",
        "activity",
        "sidenav",
        "side-header",
        "side-left-menu",
        "side",
        "side-right-menu",
        "status",
      ],
    });
  });

  test("uses the page for aggregate layouts and does not carry another project's chrome", () => {
    expect(
      resolveDashboardPersistenceScope({
        currentScope: "project/project-1/mode/project/page/start",
        modeId: "project",
        pageId: "pstdio.extension.page",
        projectId: "project-2",
      }),
    ).toEqual({
      scope: "project/project-2/mode/project/page/pstdio.extension.page",
      carryRegions: [],
    });
  });
});
