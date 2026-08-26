import { DocumentationReader } from "./documentation-reader";
import { repositoryDocPathFromUrl } from "./repository-docs";

const QUICKSTART_MARKDOWN = `# Use the CLI

The \`pst\` command starts Prompt Studio and gives people and agents the same project, agent, session, and extension tools.

## 1. Install and start

Install Prompt Studio once. Run it from the repository you want to open.

\`\`\`bash
bun add --global pstdio@latest
pst
\`\`\`

## 2. Create a project

A project gives the repository a stable name and keeps its configuration, tickets, documentation, and sessions together.

\`\`\`bash
pst projects create
\`\`\`

## 3. Connect an agent

Set up an agent once. The workbench can then start its sessions inside the active project.

\`\`\`bash
pst agents setup <agent-id>
\`\`\`

## 4. Let agents extend the workbench

The CLI is also the entry point for extensions. Ask an agent to build the command, page, editor, automation, or skill your work needs. The agent can write the TypeScript extension, validate it, and run it in development mode.

\`\`\`bash
pst extensions dev ./my-extension
\`\`\`

Extensions make new tools available to both people and agents. Read the [full CLI guide](/documentation/product/cli) or learn how to [build an extension](/documentation/extensions).
`;

interface QuickstartViewProps {
  onNavigateDoc: (path: string) => void;
}

export const QuickstartView = (props: QuickstartViewProps) => {
  const { onNavigateDoc } = props;

  return (
    <DocumentationReader
      markdown={QUICKSTART_MARKDOWN}
      onNavigateDoc={onNavigateDoc}
      resolvePathFromUrl={repositoryDocPathFromUrl}
    />
  );
};
