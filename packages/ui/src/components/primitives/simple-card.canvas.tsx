import { HStack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Terminal } from "lucide-react";
import { SimpleCard, SimpleCardBody } from "./simple-card";

const meta = { title: "Primitives/SimpleCard", component: SimpleCard } satisfies CanvasMeta<typeof SimpleCard>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Outline: Story = {
  id: "primitives-simplecard--outline",
  render: () => (
    <SimpleCard>
      <SimpleCardBody>Card body</SimpleCardBody>
    </SimpleCard>
  ),
};
export const Action: Story = {
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
