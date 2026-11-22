import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ExamplesView } from "../../components/sections/examples-view";
import { WhatIsPromptStudioView } from "../../components/sections/what-is-prompt-studio-view";
import type { ToolExampleId } from "../../content/tool-examples-content";

const Examples = () => {
  const [example, setExample] = useState<ToolExampleId>("board");
  return <ExamplesView exampleId={example} onNavigate={setExample} />;
};
const meta = {
  title: "Website/Landing/Chapters",
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
type Story = CanvasFrame<typeof meta>;
export const WhatIsPromptStudio: Story = {
  id: "theme-landing-chapters--what-is-prompt-studio",
  description:
    "One scroll of four chapters that alternate scene and text: why, any shape, tools that work together, and yours. Each isometric scene loops on its own while it is on screen.",
};
export const ExampleRecordings: Story = {
  id: "theme-landing-chapters--example-recordings",
  description:
    "A scripted recording switches between four tools like a mode change: the frame stays, panels resize, and content crossfades. Tabs show progress and jump to a tool.",
  render: () => <Examples />,
};
export const NarrowChapters: Story = {
  id: "theme-landing-chapters--narrow-chapters",
  description: "Chapters stack text above the scene and the scenes scale down.",
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
  id: "theme-landing-chapters--narrow-examples",
  description: "The recording window scales like a video to fit a phone-width panel.",
  render: () => <Examples />,
};
