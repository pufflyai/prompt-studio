import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ExamplesView } from "../../components/sections/examples-view";
import { WhatIsPromptStudioView } from "../../components/sections/what-is-prompt-studio-view";
import type { ToolExampleId } from "../../content/tool-examples-content";

const ExampleChapters = () => {
  const [example, setExample] = useState<ToolExampleId>("agents");
  return <ExamplesView exampleId={example} onNavigate={setExample} />;
};

const meta = {
  title: "Theme/Landing Chapters",
  component: WhatIsPromptStudioView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box height="100dvh">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof WhatIsPromptStudioView>;

export default meta;
type Story = StoryObj<typeof meta>;
export const WhatIsPromptStudio: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Chapters advance every eight seconds without transition animations. A compact tab row sits above the bounded chapter scroll area. Hover or focus holds the current chapter. Tabs have no numbered stepper or playback controls.",
      },
    },
  },
};
export const Examples: Story = { render: () => <ExampleChapters /> };
export const NarrowChapters: Story = {
  decorators: [
    (Story) => (
      <Box width="80" height="full">
        <Story />
      </Box>
    ),
  ],
};
export const NarrowExamples: Story = {
  ...NarrowChapters,
  render: () => <ExampleChapters />,
};
export const ShortViewport: Story = {
  decorators: [
    (Story) => (
      <Box height="28rem">
        <Story />
      </Box>
    ),
  ],
};
