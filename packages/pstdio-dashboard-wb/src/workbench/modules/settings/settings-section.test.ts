import { describe, expect, test } from "bun:test";
import { dashboardResources, dashboardSettingsResources } from "../../shared/resources";
import { resolveWorkbenchSettingsSection } from "./settings-section";

describe("resolveWorkbenchSettingsSection", () => {
  test("opens root settings to runtime when a project is selected", () => {
    expect(resolveWorkbenchSettingsSection(dashboardResources.settings, true)).toBe("runtime");
  });

  test("opens root settings to runtime without a project", () => {
    expect(resolveWorkbenchSettingsSection(dashboardResources.settings, false)).toBe("runtime");
  });

  test("maps static settings resources to their sections", () => {
    expect(resolveWorkbenchSettingsSection(dashboardSettingsResources.runtime, true)).toBe("runtime");
    expect(resolveWorkbenchSettingsSection(dashboardSettingsResources.repositories, true)).toBe("repositories");
    expect(resolveWorkbenchSettingsSection(dashboardSettingsResources.dangerZone, true)).toBe("danger-zone");
  });

  test("maps dynamic settings resources to their sections", () => {
    expect(
      resolveWorkbenchSettingsSection(
        {
          kind: "project-settings",
          uri: "dashboard-workbench://project-settings/settings/templates/Release%20notes",
          id: "settings/templates/Release%20notes",
        },
        true,
      ),
    ).toEqual({ template: "Release notes" });
    expect(
      resolveWorkbenchSettingsSection(
        {
          kind: "project-settings",
          uri: "dashboard-workbench://project-settings/settings/skills/review-code",
          id: "settings/skills/review-code",
        },
        true,
      ),
    ).toEqual({ skill: "review-code" });
  });

  test("keeps project-only resources on runtime without a selected project", () => {
    expect(resolveWorkbenchSettingsSection(dashboardSettingsResources.repositories, false)).toBe("runtime");
  });
});
