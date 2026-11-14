import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { SkillWithContent } from "@pstdio/sdk/resources";
import { FileIconThemePreferenceProvider } from "@pstdio/ui";
import { SkillViewerContent } from "./skill-viewer";

const meta: CanvasMeta<typeof SkillViewerContent> = {
  title: "Extensions/Skill Browser/Viewer",
  component: SkillViewerContent,
  fullscreen: true,
  description:
    "Read-only skill viewer with combined Info and Files, a resizable details panel, and close/reopen controls.",
  decorators: [
    (Story) => (
      <FileIconThemePreferenceProvider>
        <Box h="100vh">
          <Story />
        </Box>
      </FileIconThemePreferenceProvider>
    ),
  ],
};
export default meta;
type Story = CanvasFrame<typeof SkillViewerContent>;
const baseSkill: SkillWithContent = {
  deleted_at: null,
  id: "skill-1",
  project_id: "project-1",
  name: "create-ticket",
  title: "Create Ticket",
  description: "",
  source_kind: "extension",
  files: [
    {
      path: "SKILL.md",
      content:
        "---\nname: create-ticket\ndescription: >-\n  Create planner tickets from a short request, with a clear problem,\n  expected behavior and validation steps.\nmetadata:\n  version: 1.2.0\n---\n\n# Create Ticket\n",
      encoding: "utf8",
    },
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
export const InstalledExtensionSkill: Story = {
  id: "projectsettings-skillviewer--installed-extension-skill",
  args: { skill: baseSkill },
};
