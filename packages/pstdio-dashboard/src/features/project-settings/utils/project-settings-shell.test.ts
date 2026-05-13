import { describe, expect, test } from "bun:test";
import {
  PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
  PROJECT_SETTINGS_TREE_ID,
} from "../components/settings-navigation-tree";
import { createProjectSettingsShell, PROJECT_SETTINGS_BACK_WIDGET_ID } from "./project-settings-shell";

const labels = {
  attemptStatuses: "Attempt Statuses",
  createTag: "Create tag",
  createTemplate: "Create template",
  dangerZone: "Danger Zone",
  extensionTemplates: "Extension templates",
  extensions: "Extensions",
  harnesses: "Agents",
  projectTemplates: "Project templates",
  repositories: "Repositories",
  skills: "Skills",
  tags: "Tags",
};

describe("createProjectSettingsShell", () => {
  test("registers settings navigation as a left tree with back in the area header", async () => {
    let createTagCalls = 0;
    const shell = createProjectSettingsShell({
      projectId: "project-1",
      projectName: "Prompt Studio",
      initialSection: "tags",
      navigate: () => undefined,
      navigation: {
        current: {
          projectId: "project-1",
          labels,
          skills: [],
          tags: [],
          templates: [],
          onCreateTag: () => {
            createTagCalls += 1;
          },
          onCreateTemplate: () => undefined,
          onOpenSection: () => undefined,
        },
      },
    });

    expect(shell.trees.getTreeView(PROJECT_SETTINGS_TREE_ID)).toMatchObject({
      area: "left",
      areaSize: { defaultPx: 320, minPx: 200 },
    });
    expect(shell.layout.getWidget(PROJECT_SETTINGS_BACK_WIDGET_ID)).toMatchObject({
      area: "left-header",
      renderer: "react",
    });
    expect(shell.layout.getLayout().areas["left-header"].widgets[0]?.contributionId).toBe(
      PROJECT_SETTINGS_BACK_WIDGET_ID,
    );

    const sections = await shell.trees.getSections(PROJECT_SETTINGS_TREE_ID);
    expect(sections.some((section) => section.id === "project-back")).toBeFalse();

    await shell.commands.executeCommand(PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID);
    expect(createTagCalls).toBe(1);

    shell.dispose();
  });
});
