import { Box, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Trash2 } from "lucide-react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { getThemePreferenceClassNames } from "@/utils/apply-theme-preference";

const meta = {
  title: "Design system/Components/Forms/Delete icon buttons",
  args: { mode: "light" as "light" | "dark" },
  render: ({ mode }) => (
    <Stack
      className={getThemePreferenceClassNames(`pstdio-${mode}`, mode).join(" ")}
      data-color-mode={mode}
      data-theme={`pstdio-${mode}`}
      color="fg"
      padding="md"
      background="bg"
      gap="md"
    >
      <Text textStyle="label/M/medium">Delete actions</Text>
      <Box data-testid="idle-reference" color="fg.subtle" background="transparent" />
      <Box data-testid="active-reference" color="fg.error" background="bg.error" />
      <HStack gap="sm">
        <IconButton variant="destructive-ghost" aria-label="Delete item">
          <Icon as={Trash2} />
        </IconButton>
        <IconButton variant="destructive-ghost" aria-label="Delete disabled item" disabled>
          <Icon as={Trash2} />
        </IconButton>
      </HStack>
      <HStack className="group" data-testid="status-row" gap="sm" padding="sm">
        <Text textStyle="label/S">Status row</Text>
        <IconButton variant="destructive-ghost" size="xs" aria-label="Delete status">
          <Icon as={Trash2} />
        </IconButton>
        <IconButton variant="destructive-ghost" size="xs" aria-label="Delete default status" disabled>
          <Icon as={Trash2} />
        </IconButton>
      </HStack>
    </Stack>
  ),
} satisfies CanvasMeta<{
  mode: "light" | "dark";
}>;
export default {
  title: "Design system/Components/Forms/Delete icon buttons",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const Light: Story = {
  id: "components-inputs-delete-icon-buttons--light",
};
const Dark: Story = {
  id: "components-inputs-delete-icon-buttons--dark",
  args: { mode: "dark" },
};

const Examples = createCanvasExampleNavigator(meta, { Light, Dark });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Light };
