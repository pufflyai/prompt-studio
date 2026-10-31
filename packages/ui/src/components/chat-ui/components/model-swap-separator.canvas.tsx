import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ModelSwapSeparator } from "./model-swap-separator";

const meta: CanvasMeta<typeof ModelSwapSeparator> = {
  title: "Patterns/Chat/Model Swap Separator",
  component: ModelSwapSeparator,
};
export default meta;
type Story = CanvasFrame<typeof ModelSwapSeparator>;
export const Default: Story = {
  id: "patterns-chat-model-swap-separator--default",
  render: (args) => (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <ModelSwapSeparator {...args} />
    </Box>
  ),
  args: {
    fromModel: "GPT-5.3-Codex",
    toModel: "GPT-5.2",
  },
};
