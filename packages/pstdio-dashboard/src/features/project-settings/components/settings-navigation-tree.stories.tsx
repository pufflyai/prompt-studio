import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createShellCore } from "pstdio-shell/core";
import { ShellTreeView } from "pstdio-shell/react";
import { useEffect, useRef, useState } from "react";
import type { ProjectSkill } from "../data/skills-api";
import type { SettingsSection } from "../utils/settings-section";
import {
  buildProjectSettingsTreeSections,
  createProjectSettingsSectionResource,
  PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
  PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID,
  PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
  PROJECT_SETTINGS_TREE_ID,
  type ProjectSettingsTag,
  type ProjectSettingsTemplateAsset,
} from "./settings-navigation-tree";

interface ProjectSettingsNavigationTreeStoryProps {
  activeSection: SettingsSection;
  skills: ProjectSkill[];
  tags: ProjectSettingsTag[];
  templates: ProjectSettingsTemplateAsset[];
}

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

const ProjectSettingsNavigationTreeStory = (props: ProjectSettingsNavigationTreeStoryProps) => {
  const treeInputRef = useRef({ projectId: "project-1", labels, ...props });
  treeInputRef.current = { projectId: "project-1", labels, ...props };

  const [shell] = useState(() => {
    const nextShell = createShellCore();

    nextShell.resources.registerKind({
      kind: PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
      label: "Project settings section",
      icon: "Settings",
    });
    nextShell.resources.registerOpener({
      id: "project.settings.story.sectionOpener",
      canOpen: (resource) => resource.kind === PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
      open: (resource) => resource,
    });
    nextShell.commands.registerCommand(
      { id: PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID, label: labels.createTag, icon: "Plus" },
      { execute: () => undefined },
    );
    nextShell.commands.registerCommand(
      { id: PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID, label: labels.createTemplate, icon: "Plus" },
      { execute: () => undefined },
    );
    nextShell.trees.registerTreeView({
      id: PROJECT_SETTINGS_TREE_ID,
      title: "Project settings",
      getRoots: () => [],
      getChildren: () => [],
      getSections: () => buildProjectSettingsTreeSections(treeInputRef.current),
    });

    return nextShell;
  });

  useEffect(() => {
    if (!props.skills || !props.tags || !props.templates) return;
    shell.trees.refresh(PROJECT_SETTINGS_TREE_ID);
  }, [props.skills, props.tags, props.templates, shell]);

  return (
    <Box h="full" w="full">
      <ShellTreeView
        shell={shell}
        treeViewId={PROJECT_SETTINGS_TREE_ID}
        activeNodeId={createProjectSettingsSectionResource("project-1", props.activeSection).uri}
      />
    </Box>
  );
};

const meta: Meta<typeof ProjectSettingsNavigationTreeStory> = {
  title: "ProjectSettings/SettingsNavigationTree",
  component: ProjectSettingsNavigationTreeStory,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box height="720px" width="320px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ProjectSettingsNavigationTreeStory>;

export const SplitTemplateCatalogs: Story = {
  args: {
    activeSection: { template: "catalog-ticket" },
    tags: [],
    templates: [
      {
        name: "project-brief",
        templateType: "document",
        sourceKind: "project",
      },
      {
        name: "status-update",
        templateType: "prompt",
        sourceKind: "project",
      },
      {
        name: "catalog-ticket",
        templateType: "ticket",
        sourceKind: "extension",
      },
      {
        name: "release-note",
        templateType: "document",
        sourceKind: "extension",
      },
    ],
    skills: [
      {
        id: "project-skill-1",
        project_id: "project-1",
        name: "repo-workflow",
        title: "Repo Workflow",
        source_kind: "project",
        description: "Project owned skill.",
        files: [],
        editable: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "extension-skill-1",
        project_id: "project-1",
        name: "catalog-skill",
        title: "Catalog Skill",
        source_kind: "extension",
        description: "Extension backed skill.",
        files: [],
        editable: true,
        enabled: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
  },
};

export const ExtensionsSelected: Story = {
  args: {
    activeSection: "extensions",
    tags: [],
    templates: [],
    skills: [],
  },
};
