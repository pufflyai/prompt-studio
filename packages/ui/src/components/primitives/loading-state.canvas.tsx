import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { LoadingState, type LoadingStateProps } from "@/components/primitives/loading-state";
import { LogoLoader } from "@/components/primitives/logo-loader";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

const meta: CanvasMeta<typeof LoadingState> = {
  title: "Design system/Components/Feedback/Loading state",
  component: LoadingState,
};
export default {
  title: "Design system/Components/Feedback/Loading state",
  description:
    "Page, panel and dialog loading: the animated logo centered in an empty state, muted. Inline progress in rows and buttons keeps the small spinner.",
  fullscreen: true,
};

const Panel = {
  render: (args: LoadingStateProps) => (
    <Box display="flex" height="360px" borderWidth="1px" borderColor="border" background="bg">
      <LoadingState {...args} />
    </Box>
  ),
};
const WithText = {
  args: { title: "Starting Prompt Studio", description: "Preparing the workspace and extensions." },
  render: (args: LoadingStateProps) => (
    <Box display="flex" height="360px" borderWidth="1px" borderColor="border" background="bg">
      <LoadingState {...args} />
    </Box>
  ),
};
const Sizes = () => (
  <HStack gap="xl" align="end" padding="lg" background="bg">
    {["6", "8", "10", "12", "16"].map((size) => (
      <Stack key={size} align="center" gap="xs">
        <LogoLoader boxSize={size} />
        <Text textStyle="label/XS/regular" color="fg.muted">
          {size}
        </Text>
      </Stack>
    ))}
  </HStack>
);

const Examples = createCanvasExampleNavigator(meta, { Panel, WithText, Sizes });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
