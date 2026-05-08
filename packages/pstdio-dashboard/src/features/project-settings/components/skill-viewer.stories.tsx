import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { SkillViewerContent } from "./skill-viewer";

const meta: Meta<typeof SkillViewerContent> = {
  title: "ProjectSettings/SkillViewer",
  component: SkillViewerContent,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box height="600px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SkillViewerContent>;

const baseSkill = {
  id: "skill-1",
  project_id: "project-1",
  name: "create-pstdio-plugin",
  title: "Create pstdio plugin",
  source_kind: "project" as const,
  description: "Create and update pstdio lifecycle hooks.",
  editable: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  bundled_version: "0.0.2",
  installed_agents: ["claude-code"],
};

export const SingleFileSkill: Story = {
  args: {
    skill: {
      ...baseSkill,
      files: [
        {
          path: "SKILL.md",
          content: "---\nname: create-pstdio-plugin\nmetadata:\n  - version: 0.0.1\n---\n\n# Single file",
          encoding: "utf8",
        },
      ],
    },
    isUpdating: false,
    onUpdate: () => {},
  },
};

export const NestedMultiFileSkill: Story = {
  args: {
    skill: {
      ...baseSkill,
      files: [
        {
          path: "SKILL.md",
          content: "---\nname: create-pstdio-plugin\nmetadata:\n  - version: 0.0.1\n---\n\n# Hook workflow",
          encoding: "utf8",
        },
        {
          path: "references/environment-variables.md",
          content: "# Environment variables\n\n- PSTDIO_TICKET_ID",
          encoding: "utf8",
        },
        {
          path: "templates/hook.md",
          content: "# Hook template",
          encoding: "utf8",
        },
      ],
    },
    isUpdating: false,
    onUpdate: () => {},
  },
};

export const SkillWithCodeFiles: Story = {
  args: {
    skill: {
      ...baseSkill,
      files: [
        {
          path: "SKILL.md",
          content: "---\nname: create-pstdio-plugin\nmetadata:\n  - version: 0.0.1\n---\n\n# Code references",
          encoding: "utf8",
        },
        {
          path: "scripts/init.ts",
          content: "export const init = () => {\n  return 'ok';\n};\n",
          encoding: "utf8",
        },
        {
          path: "scripts/validate.sh",
          content: "#!/usr/bin/env bash\necho validate\n",
          encoding: "utf8",
        },
      ],
    },
    isUpdating: false,
    onUpdate: () => {},
  },
};
