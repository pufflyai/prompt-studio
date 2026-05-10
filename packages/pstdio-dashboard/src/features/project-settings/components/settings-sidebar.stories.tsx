import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { SettingsSidebar } from "./settings-sidebar";

const meta: Meta<typeof SettingsSidebar> = {
  title: "ProjectSettings/SettingsSidebar",
  component: SettingsSidebar,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box height="720px" width="280px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SettingsSidebar>;

export const SplitTemplateCatalogs: Story = {
  args: {
    activeSection: { template: "catalog-ticket" },
    tags: [],
    templates: [
      {
        id: "project-template-1",
        projectId: "project-1",
        name: "project-brief",
        title: "Project Brief",
        templateType: "document",
        sourceKind: "project",
        fileId: "file-1",
        content: "",
        isDefault: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "project-template-2",
        projectId: "project-1",
        name: "status-update",
        title: "Status Update",
        templateType: "prompt",
        sourceKind: "project",
        fileId: "file-2",
        content: "",
        isDefault: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "extension-template-1",
        projectId: "project-1",
        name: "catalog-ticket",
        title: "Catalog Ticket",
        templateType: "ticket",
        sourceKind: "extension",
        installName: "catalog",
        key: "catalogTicket",
        content: "",
        isDefault: true,
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "extension-template-2",
        projectId: "project-1",
        name: "release-note",
        title: "Release Note",
        templateType: "document",
        sourceKind: "extension",
        installName: "catalog",
        key: "releaseNote",
        content: "",
        isDefault: false,
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
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
    onCreateTag: () => {},
    onCreateTemplate: () => {},
    onSelectSection: () => {},
  },
};

export const ExtensionsSelected: Story = {
  args: {
    activeSection: "extensions",
    tags: [],
    templates: [],
    skills: [],
    onCreateTag: () => {},
    onCreateTemplate: () => {},
    onSelectSection: () => {},
  },
};
