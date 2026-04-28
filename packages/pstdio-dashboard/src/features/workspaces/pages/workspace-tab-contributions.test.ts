import { describe, expect, test } from "bun:test";
import { WORKSPACE_CHANGES_EXTENSION_ID } from "@pstdio/pstdio-ext-workspace-changes";
import {
  filterEnabledWorkspaceTabs,
  resolveSelectedWorkspaceTab,
  type WorkspaceTabContribution,
} from "./workspace-tab-contributions";

const tabs: WorkspaceTabContribution[] = [
  {
    value: "changes",
    label: "Changes",
    order: 10,
    extensionId: WORKSPACE_CHANGES_EXTENSION_ID,
    component: "changes",
  },
  {
    value: "checks",
    label: "Checks",
    order: 20,
    component: "checks",
  },
];

describe("workspace tab contributions", () => {
  test("keeps first-party extension tabs enabled by default", () => {
    expect(filterEnabledWorkspaceTabs(tabs, [], "project-1").map((tab) => tab.value)).toEqual(["changes", "checks"]);
  });

  test("removes disabled extension tabs without removing kernel tabs", () => {
    const enabledTabs = filterEnabledWorkspaceTabs(
      tabs,
      [{ project_id: "project-1", extension_id: WORKSPACE_CHANGES_EXTENSION_ID, enabled: false }],
      "project-1",
    );

    expect(enabledTabs.map((tab) => tab.value)).toEqual(["checks"]);
    expect(resolveSelectedWorkspaceTab("changes", enabledTabs)).toBe("checks");
  });
});
