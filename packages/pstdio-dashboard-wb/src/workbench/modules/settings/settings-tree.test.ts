import { describe, expect, test } from "bun:test";
import type { TreeViewSection } from "pstdio-workbench/core";
import { dashboardSettingsResources } from "../../shared/resources";
import type { ProjectTemplateAsset } from "./data/project-types";
import type { ProjectSkill } from "./data/skills-api";
import { buildDashboardSettingsTree } from "./settings-tree";

const template = (
  name: string,
  templateType: ProjectTemplateAsset["templateType"],
  sourceKind: "project" | "extension",
) =>
  ({
    id: `${sourceKind}-${name}`,
    projectId: "project-1",
    name,
    title: name,
    templateType,
    sourceKind,
    content: "",
    isDefault: false,
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
  }) satisfies ProjectTemplateAsset;

const skill = (name: string) =>
  ({
    id: name,
    project_id: "project-1",
    name,
    title: name,
    description: `${name} description`,
    source_kind: "project",
    files: [],
    editable: true,
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
  }) satisfies ProjectSkill;

const nodeIds = (sections: TreeViewSection[]) =>
  sections.flatMap((section) =>
    section.nodes.flatMap((node) => [node.id, ...(node.children ?? []).flatMap((child) => [child.id])]),
  );

describe("buildDashboardSettingsTree", () => {
  test("builds the classic project settings layout without ticket settings", () => {
    const sections = buildDashboardSettingsTree({
      hasProject: true,
      skills: [skill("review-code")],
      templates: [
        template("Release notes", "prompt", "project"),
        template("Architecture note", "document", "project"),
        template("Extension prompt", "prompt", "extension"),
      ],
    });

    expect(sections.map((section) => section.id)).toEqual([
      "project-settings",
      "general",
      "project-templates",
      "extension-templates",
      "danger",
    ]);
    expect(sections[0]?.nodes.map((node) => node.id)).toEqual([
      dashboardSettingsResources.runtime.uri,
      dashboardSettingsResources.harnesses.uri,
      dashboardSettingsResources.extensions.uri,
      dashboardSettingsResources.repositories.uri,
    ]);
    expect(sections[1]).toEqual(
      expect.objectContaining({
        id: "general",
        nodes: [
          expect.objectContaining({
            id: "skills",
            label: "Skills",
            children: [expect.objectContaining({ label: "review-code" })],
          }),
        ],
      }),
    );
    expect(sections[2]).toEqual(
      expect.objectContaining({
        id: "project-templates",
        label: "Project templates",
        nodes: [
          expect.objectContaining({ id: "project-template-group:prompt", label: "Prompts" }),
          expect.objectContaining({ id: "project-template-group:document", label: "Documents" }),
        ],
      }),
    );
    expect(sections[3]).toEqual(
      expect.objectContaining({
        id: "extension-templates",
        label: "Extension templates",
        nodes: [expect.objectContaining({ id: "extension-template-group:prompt", label: "Prompts" })],
      }),
    );
    expect(nodeIds(sections)).not.toEqual(
      expect.arrayContaining([
        "dashboard-workbench://project-settings/settings/ticket-statuses",
        "dashboard-workbench://project-settings/settings/attempt-statuses",
        "dashboard-workbench://project-settings/settings/tags",
      ]),
    );
  });

  test("uses the projectless runtime and harnesses layout when no project is selected", () => {
    expect(buildDashboardSettingsTree({ hasProject: false, skills: [], templates: [] })).toEqual([
      expect.objectContaining({
        id: "runtime-harnesses",
        nodes: [
          expect.objectContaining({ id: dashboardSettingsResources.runtime.uri }),
          expect.objectContaining({ id: dashboardSettingsResources.harnesses.uri }),
        ],
      }),
    ]);
  });
});
