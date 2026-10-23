import { HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Terminal } from "lucide-react";
import { SimpleCard, SimpleCardBody } from "./simple-card";

const meta = { title: "Primitives/SimpleCard", component: SimpleCard } satisfies Meta<typeof SimpleCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Outline: Story = {
  render: () => (
    <SimpleCard>
      <SimpleCardBody>Card body</SimpleCardBody>
    </SimpleCard>
  ),
};
export const Action: Story = {
  render: () => (
    <SimpleCard variant="action" asChild>
      <button type="button">
        <SimpleCardBody>
          <HStack gap="sm">
            <Terminal size={20} />
            <Text textStyle="label/M/regular">Terminal</Text>
          </HStack>
        </SimpleCardBody>
      </button>
    </SimpleCard>
  ),
};
