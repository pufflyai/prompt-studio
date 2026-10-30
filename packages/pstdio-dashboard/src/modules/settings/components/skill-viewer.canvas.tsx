import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { FileIconThemePreferenceProvider } from "@pstdio/ui";
import type { ProjectSkillDetails } from "../data/skills-api";
import { SkillViewerContent } from "./skill-viewer";

const meta: CanvasMeta<typeof SkillViewerContent> = {
  title: "ProjectSettings/SkillViewer",
  component: SkillViewerContent,
  fullscreen: true,
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
type Story = CanvasVariant<typeof SkillViewerContent>;
const baseSkill: ProjectSkillDetails = {
  deleted_at: null,
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
  id: "projectsettings-skillviewer--installed-extension-skill",
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
  id: "projectsettings-skillviewer--not-installed-skill",
  args: {
    skill: { ...baseSkill, installed_agents: [], agent_installations: [] },
  },
};
