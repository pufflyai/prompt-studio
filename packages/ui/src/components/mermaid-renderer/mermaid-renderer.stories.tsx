import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { useThemePreference } from "../../utils/theme-preference";
import { mermaidFixtures } from "./mermaid-fixtures";
import { MermaidRenderer } from "./mermaid-renderer";

const meta: Meta<typeof MermaidRenderer> = {
  title: "Patterns/Editors/Mermaid Renderer",
  component: MermaidRenderer,
  parameters: {
    layout: "padded",
  },
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

type Story = StoryObj<typeof MermaidRenderer>;

const SourceChangeResetStory = () => {
  const [code, setCode] = useState(mermaidFixtures.ps81Flowchart);

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

export const Default: Story = {};

export const ReadOnly: Story = {
  args: {
    isEditable: false,
    onRequestEdit: undefined,
  },
};

export const SequenceDiagram: Story = {
  args: {
    code: mermaidFixtures.sequence,
  },
};

export const StateDiagram: Story = {
  args: {
    code: mermaidFixtures.state,
  },
};

export const EntityRelationshipDiagram: Story = {
  args: {
    code: mermaidFixtures.er,
  },
};

export const ClassDiagram: Story = {
  args: {
    code: mermaidFixtures.class,
  },
};

export const GanttChart: Story = {
  args: {
    code: mermaidFixtures.gantt,
  },
};

export const DarkMode: Story = {
  globals: {
    theme: "pstdio-dark",
  },
};

export const InvalidSyntax: Story = {
  args: {
    code: mermaidFixtures.invalid,
  },
};

export const FullscreenOpen: Story = {
  tags: ["!manifest"],
  args: {
    initialFullscreenOpen: true,
  },
};

export const ZoomedInPan: Story = {
  tags: ["!manifest"],
  args: {
    initialZoom: 1.5,
  },
};

export const SourceChangeReset: Story = {
  tags: ["!manifest"],
  render: () => <SourceChangeResetStory />,
};

export const ThemeToggle: Story = {
  tags: ["!manifest"],
  render: () => <ThemeToggleStory />,
};

export const ZoomControlPlay: Story = {
  tags: ["!manifest"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("img", { name: "Mermaid diagram" });
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await expect(canvas.getByTestId("mermaid-diagram-transform")).toHaveAttribute("data-pan-enabled", "true");
  },
};

export const FullscreenPlay: Story = {
  tags: ["!manifest"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("img", { name: "Mermaid diagram" });
    await userEvent.click(canvas.getByRole("button", { name: "Fullscreen" }));
    await expect(within(document.body).getByRole("dialog", { name: "Mermaid diagram" })).toBeVisible();
  },
};

export const PanGatePlay: Story = {
  tags: ["!manifest"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("img", { name: "Mermaid diagram" });

    const transform = canvas.getByTestId("mermaid-diagram-transform");
    const before = getComputedStyle(transform).transform;
    fireEvent.pointerDown(transform, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(transform, { pointerId: 1, clientX: 80, clientY: 40 });
    fireEvent.pointerUp(transform, { pointerId: 1 });

    await expect(transform).toHaveAttribute("data-pan-enabled", "false");
    expect(getComputedStyle(transform).transform).toBe(before);
  },
};
