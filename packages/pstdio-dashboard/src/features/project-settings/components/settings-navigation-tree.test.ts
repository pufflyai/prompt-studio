import { describe, expect, test } from "bun:test";
import {
  buildProjectSettingsTreeSections,
  createProjectSettingsSectionResource,
  PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
  PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID,
  PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
  parseProjectSettingsSectionResource,
} from "./settings-navigation-tree";

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

describe("settings-navigation-tree", () => {
  test("builds project settings shell tree nodes from section resources", () => {
    const sections = buildProjectSettingsTreeSections({
      projectId: "project-1",
      labels,
      tags: [{ id: "tag-1", name: "Priority" }],
      skills: [
        {
          id: "skill-1",
          project_id: "project-1",
          name: "repo-workflow",
          title: "Repo Workflow",
          source_kind: "project",
          description: "Repository workflow skill.",
          files: [],
          editable: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      templates: [
        {
          name: "ticket-template",
          templateType: "ticket",
          sourceKind: "project",
        },
      ],
    });

    const tagsNode = sections
      .find((section) => section.id === "general")
      ?.nodes.find((node) => node.label === labels.tags);
    const skillsNode = sections
      .find((section) => section.id === "general")
      ?.nodes.find((node) => node.label === labels.skills);
    const templatesSection = sections.find((section) => section.id === "project-templates");
    const projectToolsSection = sections.find((section) => section.id === "project-tools");

    expect(sections.some((section) => section.id === "project-back")).toBeFalse();
    expect(sections.some((section) => section.id === "skills")).toBeFalse();
    expect(tagsNode?.id).toBe(createProjectSettingsSectionResource("project-1", "tags").uri);
    expect(tagsNode?.actions?.[0]).toMatchObject({
      id: PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
      commandId: PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
    });
    expect(tagsNode?.children?.[0]?.resource).toMatchObject({
      kind: PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
      id: "tag:tag-1",
    });
    expect(skillsNode?.children?.[0]?.resource).toMatchObject({
      kind: PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
      id: "skill:repo-workflow",
    });
    expect(templatesSection).toMatchObject({
      label: labels.projectTemplates,
      actions: [
        {
          id: PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID,
          commandId: PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID,
        },
      ],
    });
    expect(templatesSection?.nodes[0]?.children?.[0]?.resource).toMatchObject({
      kind: PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
      id: "template:ticket-template",
    });
    expect(projectToolsSection?.nodes.map((node) => node.label)).toEqual([
      labels.repositories,
      labels.harnesses,
      labels.extensions,
    ]);
  });

  test("parses a project settings section resource back to a settings section", () => {
    const resource = createProjectSettingsSectionResource("project-1", { tag: "tag-1" });

    expect(parseProjectSettingsSectionResource(resource)).toEqual({ tag: "tag-1" });
  });
});
