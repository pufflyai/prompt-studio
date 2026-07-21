import type { DocPage } from "../doc-view";

export const cliAgentsPage: DocPage = {
  title: "Agents",
  intro:
    "Agents are coding harnesses contributed by extensions. Setup connects an installed harness to project-specific workflow skills.",
  blocks: [
    { type: "heading", text: "Discover harnesses" },
    { type: "code", code: "pst agents list" },
    {
      type: "paragraph",
      text: "The list shows each harness's display name, namespaced ID, and whether its executable is installed. First-party harnesses integrate Codex, Claude Code, and OpenCode; enabled extensions can contribute others.",
    },
    {
      type: "paragraph",
      text: "Commands accept either the full ID, such as `pstdio.harness-codex.codex`, or an unambiguous local ID printed by the harness.",
    },
    { type: "heading", text: "Set up a project agent" },
    {
      type: "code",
      code: `pst agents setup pstdio.harness-codex.codex
pst agents setup pstdio.harness-claude-code.claude-code
pst agents setup pstdio.harness-open-code.opencode`,
    },
    {
      type: "paragraph",
      text: "Run setup from a linked git repository. Prompt Studio resolves the harness and installs the project's enabled skill catalog into that harness's project skill directory.",
    },
    { type: "heading", text: "Project skills versus global skills" },
    {
      type: "code",
      code: `# Default: install skills for this repository
pst agents install-skills pstdio.harness-codex.codex

# Install the catalog in the harness's global skill directory
pst agents install-skills pstdio.harness-codex.codex --global-skills`,
    },
    {
      type: "paragraph",
      text: "Skill installation is additive: existing skill directories are never overwritten. Re-running `install-skills` adds only missing skills, which preserves local edits but means you must remove an old skill directory yourself before reinstalling a fresh bundled copy.",
    },
    {
      type: "paragraph",
      text: "Project installation requires a git repository with `.pstdio/config.json`. Use `--global-skills` when you intentionally want the skills outside one project.",
    },
    { type: "heading", text: "Select an agent for work" },
    {
      type: "code",
      code: `pst sessions create \\
  --agent pstdio.harness-codex.codex \\
  --prompt "Review the current changes."

pst tickets implement --id PS-42 --agent pstdio.harness-codex.codex`,
    },
    {
      type: "paragraph",
      text: "The selected harness owns model discovery and process execution. Prompt Studio owns the session record, workspace link, permissions, persistence, and lifecycle shown in the workbench.",
    },
    { type: "heading", text: "Troubleshooting" },
    {
      type: "list",
      items: [
        "Agent not found: run `pst agents list` and use an installed ID from the table.",
        "Skills missing: confirm the repository is linked, then run `pst agents install-skills <agent-id>`.",
        "Custom skill did not update: installation preserves existing directories; compare or remove the local copy before reinstalling.",
      ],
    },
  ],
};
