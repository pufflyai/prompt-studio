import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
  fullscreen: true,
  decorators: [
    (Story) => (
      <Box height="100dvh">
        <Story />
      </Box>
    ),
  ],
} satisfies CanvasMeta<typeof WhatIsPromptStudioView>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const WhatIsPromptStudio: Story = {
  id: "theme-landing-chapters--what-is-prompt-studio",
  description:
    "Chapters advance every eight seconds without transition animations. A compact tab row sits above the bounded chapter scroll area. Hover or focus holds the current chapter. Tabs have no numbered stepper or playback controls.",
};
export const Examples: Story = {
  id: "theme-landing-chapters--examples",
  render: () => <ExampleChapters />,
};
export const NarrowChapters: Story = {
  id: "theme-landing-chapters--narrow-chapters",
  decorators: [
    (Story) => (
      <Box width="80" height="full">
        <Story />
      </Box>
    ),
  ],
};
export const NarrowExamples: Story = {
  id: "theme-landing-chapters--narrow-examples",
  ...NarrowChapters,
  render: () => <ExampleChapters />,
};
export const ShortViewport: Story = {
  id: "theme-landing-chapters--short-viewport",
  decorators: [
    (Story) => (
      <Box height="28rem">
        <Story />
      </Box>
    ),
  ],
};
