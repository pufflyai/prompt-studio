import { DocumentationReader } from "./documentation-reader";
import { repositoryDocPathFromUrl } from "./repository-docs";

const QUICKSTART_MARKDOWN = `# Let your agent extend the CLI

When a command is missing, ask your agent to add it as a Prompt Studio extension. The new command becomes part of the project CLI.

## 1. Describe the command you need

Tell the agent what the command should do and what input it needs.

> Add a release-note command that reads a ticket and writes a customer update.

## 2. The agent adds an extension command

The extension defines a command that people and agents can both use.

\`\`\`typescript
export default defineExtension({
  commands: {
    "release-note": {
      agent: true,
      run: () => buildReleaseNote(),
    },
  },
});
\`\`\`

## 3. Use the new command

The command is now available from the project CLI.

\`\`\`bash
pst release-note --ticket PS-460
\`\`\`

Read the [extension documentation](/documentation/extensions) to see the full API.
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
