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

export const ExtensionTemplatesAndSkills: Story = {
  args: {
    activeSection: { template: "lab.labTicket" },
    onSelectSection: () => undefined,
    onCreateTemplate: () => undefined,
    onCreateTag: () => undefined,
    tags: [],
    skills: [
      {
        id: "skill-lab",
        project_id: "project-1",
        name: "lab.lab",
        description: "Lab skill default.",
        files: [],
        installed_agents: ["claude-code", "opencode"],
        extension_name: "Extension Lab",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    templates: [
      {
        id: "extension:pstdio.extension-lab:labTicket",
        projectId: "project-1",
        name: "lab.labTicket",
        templateType: "ticket",
        fileId: "/Users/example/.pstdio/extensions/extension-lab/templates/lab-ticket.md",
        content: "",
        isDefault: false,
        sourceKind: "extension-default",
        readOnly: false,
        extensionId: "pstdio.extension-lab",
        extensionName: "Extension Lab",
        templateKey: "labTicket",
        createdAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
      },
      {
        id: "template-project",
        projectId: "project-1",
        name: "project-ticket",
        templateType: "ticket",
        fileId: "file-1",
        content: "",
        isDefault: true,
        sourceKind: "project",
        readOnly: false,
        extensionId: null,
        extensionName: null,
        templateKey: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
  },
};
