import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { useThemePreference } from "../../utils/theme-preference";
import { mermaidFixtures } from "./mermaid-fixtures";
import { MermaidRenderer } from "./mermaid-renderer";

const meta: CanvasMeta<typeof MermaidRenderer> = {
  title: "Patterns/Editors/Mermaid Renderer",
  component: MermaidRenderer,
  decorators: [
    (Story) => (
      <Box maxW="920px">
        <Story />
      </Box>
    ),
  ],
  args: {
    code: mermaidFixtures.ps81Flowchart,
    isEditable: true,
    onRequestEdit: () => undefined,
  },
};
export default meta;
type Story = CanvasFrame<typeof MermaidRenderer>;
const SourceChangeResetStory = () => {
  const [code, setCode] = useState<string>(mermaidFixtures.ps81Flowchart);
  return (
    <Stack gap="sm">
      <Button size="sm" alignSelf="flex-start" onClick={() => setCode(mermaidFixtures.sequence)}>
        Change diagram source
      </Button>
      <MermaidRenderer code={code} isEditable onRequestEdit={() => undefined} />
    </Stack>
  );
};
const ThemeToggleStory = () => {
  const { themePreference, toggleThemePreference } = useThemePreference();
  return (
    <Stack gap="sm">
      <Button size="sm" alignSelf="flex-start" onClick={toggleThemePreference}>
        Toggle theme
      </Button>
      <Box data-testid="mermaid-theme-preference" data-theme-preference={themePreference}>
        <MermaidRenderer code={mermaidFixtures.ps81Flowchart} isEditable onRequestEdit={() => undefined} />
      </Box>
    </Stack>
  );
};
export const Default: Story = {
  id: "patterns-editors-mermaid-renderer--default",
};
export const ReadOnly: Story = {
  id: "patterns-editors-mermaid-renderer--read-only",
  args: {
    isEditable: false,
    onRequestEdit: undefined,
  },
};
export const SequenceDiagram: Story = {
  id: "patterns-editors-mermaid-renderer--sequence-diagram",
  args: {
    code: mermaidFixtures.sequence,
  },
};
export const StateDiagram: Story = {
  id: "patterns-editors-mermaid-renderer--state-diagram",
  args: {
    code: mermaidFixtures.state,
  },
};
export const EntityRelationshipDiagram: Story = {
  id: "patterns-editors-mermaid-renderer--entity-relationship-diagram",
  args: {
    code: mermaidFixtures.er,
  },
};
export const ClassDiagram: Story = {
  id: "patterns-editors-mermaid-renderer--class-diagram",
  args: {
    code: mermaidFixtures.class,
  },
};
export const GanttChart: Story = {
  id: "patterns-editors-mermaid-renderer--gantt-chart",
  args: {
    code: mermaidFixtures.gantt,
  },
};
export const DarkMode: Story = {
  id: "patterns-editors-mermaid-renderer--dark-mode",
};
export const InvalidSyntax: Story = {
  id: "patterns-editors-mermaid-renderer--invalid-syntax",
  args: {
    code: mermaidFixtures.invalid,
  },
};
export const FullscreenOpen: Story = {
  id: "patterns-editors-mermaid-renderer--fullscreen-open",
  args: {
    initialFullscreenOpen: true,
  },
};
export const ZoomedInPan: Story = {
  id: "patterns-editors-mermaid-renderer--zoomed-in-pan",
  args: {
    initialZoom: 1.5,
  },
};
export const SourceChangeReset: Story = {
  id: "patterns-editors-mermaid-renderer--source-change-reset",
  render: () => <SourceChangeResetStory />,
};
export const ThemeToggle: Story = {
  id: "patterns-editors-mermaid-renderer--theme-toggle",
  render: () => <ThemeToggleStory />,
};
export const ZoomControlPlay: Story = {
  id: "patterns-editors-mermaid-renderer--zoom-control-play",
};
export const FullscreenPlay: Story = {
  id: "patterns-editors-mermaid-renderer--fullscreen-play",
};
export const PanGatePlay: Story = {
  id: "patterns-editors-mermaid-renderer--pan-gate-play",
};
