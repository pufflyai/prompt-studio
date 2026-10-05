import { FileIconThemePreferenceProvider } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import type { ProjectSkillDetails } from "../data/skills-api";
import { SkillViewerContent } from "./skill-viewer";

const meta: Meta<typeof SkillViewerContent> = {
  title: "ProjectSettings/SkillViewer",
  component: SkillViewerContent,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <FileIconThemePreferenceProvider>
        <div style={{ height: "640px" }}>
          <Story />
        </div>
      </FileIconThemePreferenceProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SkillViewerContent>;

const baseSkill: ProjectSkillDetails = {
  id: "skill-1",
  project_id: "project-1",
  name: "create-ticket",
  title: "Create Ticket",
  description: "Create planner tickets from a short request.",
  source_kind: "extension",
  files: [
    { path: "SKILL.md", content: "---\nmetadata:\n  version: 1.2.0\n---\n\n# Create Ticket\n", encoding: "utf8" },
    { path: "references/examples.md", content: "# Examples\n", encoding: "utf8" },
  ],
  editable: true,
  extension_instance_id: "extension-instance-1",
  extension_id: "pstdio.planner",
  installed_extension_id: "installed-extension-1",
  install_name: "pstdio-planner",
  key: "createTicket",
  enabled: true,
  installed_agents: ["pstdio.harness-claude-code.harness.claude-code", "pstdio.harness-codex.harness.codex"],
  agent_installations: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const installation = (agentId: string, agentName: string) => ({
  agent_id: agentId,
  agent_name: agentName,
  installed_version: "1.2.0",
});

// Workspace provisioning copies the skill into each agent's skill folder.
export const InstalledExtensionSkill: Story = {
  args: {
    skill: {
      ...baseSkill,
      agent_installations: [
        installation("pstdio.harness-claude-code.harness.claude-code", "claude-code"),
        installation("pstdio.harness-codex.harness.codex", "codex"),
      ],
    },
  },
};

export const NotInstalledSkill: Story = {
  args: {
    skill: { ...baseSkill, installed_agents: [], agent_installations: [] },
  },
};
