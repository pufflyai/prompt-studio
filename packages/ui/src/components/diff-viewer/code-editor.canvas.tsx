import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ThemePreferenceProvider, useThemePreference } from "../../utils/theme-preference";
import { CodeDiffEditor, CodeEditor } from "./code-editor";

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
} satisfies CanvasMeta<typeof CodeEditor>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Editable: Story = {
  id: "patterns-editors-code-editor--editable",
};
export const ReadOnly: Story = {
  id: "patterns-editors-code-editor--read-only",
  args: { isEditable: false },
};
export const ConstrainedContainer: Story = {
  id: "patterns-editors-code-editor--constrained-container",
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
};
export const Tsx: Story = {
  id: "patterns-editors-code-editor--tsx",
  args: {
    fileName: "icon.tsx",
    defaultCode: 'declare const React: any;\nexport const Icon = () => <svg width={24}><path d="M0 0" /></svg>;\n',
  },
};
export const Diff: Story = {
  id: "patterns-editors-code-editor--diff",
  render: () => (
    <CodeDiffEditor
      language="typescript"
      original={"export const greeting = 'Hello';\n"}
      modified={"export const greeting = 'Welcome';\n"}
      showLineNumbers
    />
  ),
};
const ThemeSwitchingEditors = () => {
  const { toggleThemePreference } = useThemePreference();
  return (
    <Stack height="full">
      <Button alignSelf="start" onClick={toggleThemePreference}>
        Toggle theme
      </Button>
      <Box flex="1" minHeight="0">
        <CodeEditor language="typescript" defaultCode="const greeting = 'Hello';" isEditable />
      </Box>
      <Box flex="1" minHeight="0">
        <CodeDiffEditor
          language="typescript"
          original="const greeting = 'Hello';"
          modified="const greeting = 'Welcome';"
        />
      </Box>
    </Stack>
  );
};
export const ThemeSwitching: Story = {
  id: "patterns-editors-code-editor--theme-switching",
  render: () => (
    <ThemePreferenceProvider initialPreference="pstdio-light">
      <ThemeSwitchingEditors />
    </ThemePreferenceProvider>
  ),
};
