import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProjectSkillDetails } from "../data/skills-api";
import { SkillViewerContent } from "./skill-viewer";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof SkillViewerContent> = {
  title: "ProjectSettings/SkillViewer",
  component: SkillViewerContent,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ height: "640px" }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SkillViewerContent>;

// Catalog SKILL.md advertises version 1.2.0; stories vary the installed version per agent.
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
  installed_agents: ["pstdio.harness-claude-code.claude-code", "pstdio.harness-codex.codex"],
  outdated_agents: [],
  agent_installations: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const installation = (agentId: string, agentName: string, installedVersion: string, outdated: boolean) => ({
  agent_id: agentId,
  agent_name: agentName,
  installed_version: installedVersion,
  outdated,
});

// Installed version differs from the catalog -> "Out of date" + an update affordance.
export const OutdatedExtensionSkill: Story = {
  args: {
    skill: {
      ...baseSkill,
      outdated_agents: ["pstdio.harness-claude-code.claude-code", "pstdio.harness-codex.codex"],
      agent_installations: [
        installation("pstdio.harness-claude-code.claude-code", "claude-code", "1.1.0", true),
        installation("pstdio.harness-codex.codex", "codex", "1.1.0", true),
      ],
    },
  },
};

// Installed version matches the catalog -> no "Out of date" badge and no update button.
export const UpToDateExtensionSkill: Story = {
  args: {
    skill: {
      ...baseSkill,
      agent_installations: [
        installation("pstdio.harness-claude-code.claude-code", "claude-code", "1.2.0", false),
        installation("pstdio.harness-codex.codex", "codex", "1.2.0", false),
      ],
    },
  },
};
