import { Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { RendererReadNotice } from "./renderer-read-notice";

const meta = {
  title: "Renderers/Read failure",
  component: RendererReadNotice,
  args: { error: "The view could not be refreshed. Try again.", retry: () => {} },
} satisfies CanvasMeta<typeof RendererReadNotice>;
export default meta;
type Story = CanvasVariant<typeof RendererReadNotice>;
export const InitialFailure: Story = {
  id: "renderers-read-failure--initial-failure",
};
export const RetainedContent: Story = {
  id: "renderers-read-failure--retained-content",
  render: (args) => (
    <Stack gap="md">
      <RendererReadNotice {...args} />
      <Text>Previously loaded content remains visible.</Text>
    </Stack>
  ),
};
