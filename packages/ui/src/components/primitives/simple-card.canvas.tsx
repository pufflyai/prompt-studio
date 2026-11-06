import { HStack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Terminal } from "lucide-react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { SimpleCard, SimpleCardBody } from "./simple-card";

const meta = { title: "Design system/Components/Layout/Simple card", component: SimpleCard } satisfies CanvasMeta<
  typeof SimpleCard
>;
export default {
  title: "Design system/Components/Layout/Simple card",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const Outline: Story = {
  id: "primitives-simplecard--outline",
  render: () => (
    <SimpleCard>
      <SimpleCardBody>Card body</SimpleCardBody>
    </SimpleCard>
  ),
};
const Action: Story = {
  id: "primitives-simplecard--action",
  description: "Hover and pressed feedback changes immediately, including when the pointer leaves.",
  render: () => (
    <SimpleCard variant="action" asChild>
      <button type="button">
        <SimpleCardBody>
          <HStack gap="xs">
            <Terminal size={14} />
            <Text textStyle="label/M/regular">Terminal</Text>
          </HStack>
        </SimpleCardBody>
      </button>
    </SimpleCard>
  ),
};

const Examples = createCanvasExampleNavigator(meta, { Outline, Action });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Outline };
