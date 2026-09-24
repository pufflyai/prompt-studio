import { Box } from "@chakra-ui/react";
import { loader } from "@monaco-editor/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor } from "storybook/test";
import { CodeDiffEditor, CodeEditor, preloadCodeEditor } from "./code-editor";

const meta = {
  title: "Patterns/Editors/Code Editor",
  component: CodeEditor,
  decorators: [
    (Story) => (
      <Box height="2xl" width="full">
        <Story />
      </Box>
    ),
  ],
  args: {
    language: "typescript",
    defaultCode: "export const greeting = 'Hello';\n",
    isEditable: true,
    showLineNumbers: true,
  },
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};

export const ReadOnly: Story = { args: { isEditable: false } };

export const Tsx: Story = {
  args: {
    fileName: "icon.tsx",
    defaultCode: 'declare const React: any;\nexport const Icon = () => <svg width={24}><path d="M0 0" /></svg>;\n',
  },
  play: async () => {
    await preloadCodeEditor();
    const monaco: typeof import("monaco-editor") = await loader.init();
    await waitFor(
      async () => {
        const model = monaco.editor.getModels().find((candidate) => candidate.getValue().includes("const Icon"));
        expect(model).toBeDefined();
        const getWorker = await monaco.typescript.getTypeScriptWorker();
        const uri = model!.uri.toString();
        const worker = await getWorker(model!.uri);
        expect(await worker.getSyntacticDiagnostics(uri)).toEqual([]);
        expect(await worker.getSemanticDiagnostics(uri)).toEqual([]);
      },
      { timeout: 5_000 },
    );
  },
};

export const Diff: Story = {
  render: () => (
    <CodeDiffEditor
      language="typescript"
      original={"export const greeting = 'Hello';\n"}
      modified={"export const greeting = 'Welcome';\n"}
      showLineNumbers
    />
  ),
};
