import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ExamplesView } from "../../components/sections/examples-view";
import { HowDoesItWorkView } from "../../components/sections/how-does-it-work-view";
import { WhatIsPromptStudioView } from "../../components/sections/what-is-prompt-studio-view";
import type { ToolExampleId } from "../../content/tool-examples-content";

const ExampleChapters = () => {
  const [example, setExample] = useState<ToolExampleId>("agents");
  return <ExamplesView exampleId={example} onNavigate={setExample} />;
};

const meta = {
  title: "Theme/Landing Chapters",
  component: HowDoesItWorkView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box height="100dvh">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof HowDoesItWorkView>;

export default meta;
type Story = StoryObj<typeof meta>;
export const WhatIsPromptStudio: Story = {
  render: () => <WhatIsPromptStudioView />,
  parameters: {
    docs: {
      description: {
        story:
          "A working reading list beside editable notes shows the request, the tool, and a requested change. Add an item, mark it read, then add the unread filter. Existing items and notes stay intact.",
      },
    },
  },
};
export const HowDoesItWork: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "At 2560 by 1440 each chapter fills the available height. Building-block cards stop at the small width token and follow their content instead of stretching with the chapter. Phones and short windows scroll to every control and documentation link. Chapters advance every eight seconds without transition animations. A compact tab row sits above the bounded chapter scroll area. Hover or focus holds the current chapter. Tabs have no numbered stepper or playback controls.",
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

export const NarrowPurpose: Story = {
  ...NarrowChapters,
  render: () => <WhatIsPromptStudioView />,
};
export const ShortPurpose: Story = {
  ...ShortViewport,
  render: () => <WhatIsPromptStudioView />,
};
