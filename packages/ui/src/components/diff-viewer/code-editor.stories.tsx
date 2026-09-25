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

export const ConstrainedContainer: Story = {
  tags: ["!manifest"],
  args: {
    defaultCode: 'export const greeting: number = "Hello";\n',
  },
  decorators: [
    (Story) => (
      <Box width="xs" height="2xs" overflow="hidden" borderWidth="1px" borderColor="border.subtle">
        <Story />
      </Box>
    ),
  ],
  play: async ({ canvasElement }) => {
    await preloadCodeEditor();
    const monaco: typeof import("monaco-editor") = await loader.init();
    const editor = await waitFor(
      () => {
        const instance = monaco.editor.getEditors().find((candidate) => canvasElement.contains(candidate.getDomNode()));
        expect(instance).toBeDefined();
        expect(monaco.editor.getModelMarkers({ resource: instance!.getModel()!.uri }).length).toBeGreaterThan(0);
        return instance!;
      },
      { timeout: 5_000 },
    );
    editor.setPosition({ lineNumber: 1, column: 15 });
    await editor.getAction("editor.action.showHover")!.run();
    await waitFor(() => {
      const hover = canvasElement.querySelector<HTMLElement>(".monaco-hover");
      expect(hover).toBeVisible();
      const bounds = hover!.getBoundingClientRect();
      expect(bounds.right).toBeGreaterThan(editor.getDomNode()!.getBoundingClientRect().right);
      const document = canvasElement.ownerDocument;
      for (const x of [bounds.left + 5, bounds.right - 5]) {
        for (const y of [bounds.top + 5, bounds.bottom - 5]) {
          expect(hover!.contains(document.elementFromPoint(x, y))).toBe(true);
        }
      }
    });
  },
};

export const Tsx: Story = {
  args: {
    fileName: "icon.tsx",
    defaultCode: 'declare const React: any;\nexport const Icon = () => <svg width={24}><path d="M0 0" /></svg>;\n',
  },
  play: async ({ canvasElement }) => {
    await preloadCodeEditor();
    const monaco: typeof import("monaco-editor") = await loader.init();
    const editor = await waitFor(
      () => {
        const instance = monaco.editor.getEditors().find((candidate) => canvasElement.contains(candidate.getDomNode()));
        expect(instance).toBeDefined();
        return instance!;
      },
      { timeout: 5_000 },
    );
    const model = editor.getModel()!;
    const source = model.getValue();
    const uri = model.uri.toString();
    const getWorker = await monaco.typescript.getTypeScriptWorker();
    const worker = await getWorker(model.uri);
    await waitFor(async () => {
      expect(await worker.getSyntacticDiagnostics(uri)).toEqual([]);
      expect(await worker.getSemanticDiagnostics(uri)).toEqual([]);
    });
    try {
      model.setValue(`${source}\nexport const invalid: number = "wrong";`);
      await waitFor(async () => {
        const diagnostics = await worker.getSemanticDiagnostics(uri);
        expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(2322);
      });
    } finally {
      model.setValue(source);
    }
    await waitFor(async () => {
      expect(await worker.getSemanticDiagnostics(uri)).toEqual([]);
    });
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
