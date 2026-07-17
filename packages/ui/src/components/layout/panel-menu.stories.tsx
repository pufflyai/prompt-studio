import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Paperclip, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { PanelMenu, PanelMenuToggle } from "./panel-menu";

const MenuBody = (props: { label: string }) => (
  <Stack w="full" gap="2xs" p="xs">
    <Text textStyle="label/XS/medium">{props.label}</Text>
    <Text textStyle="label/XS" color="fg.muted">
      Panel-owned controls
    </Text>
  </Stack>
);

const PanelContent = () => (
  <Flex flex="1" minW="0" align="center" justify="center" bg="bg.subtle">
    <Text textStyle="label/S/medium">Content</Text>
  </Flex>
);

const meta = {
  title: "Components/Layout/Panel menu",
  component: PanelMenu,
  decorators: [
    (Story) => (
      <Box h="20rem" w="40rem" bg="bg" borderWidth="1px" borderColor="border">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof PanelMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothAttached: Story = {
  render: () => (
    <Flex h="full">
      <PanelMenu title="Files" icon={<Paperclip size={12} />} side="left">
        <MenuBody label="Context files" />
      </PanelMenu>
      <PanelContent />
      <PanelMenu title="Properties" icon={<SlidersHorizontal size={12} />} side="right">
        <MenuBody label="Run parameters" />
      </PanelMenu>
    </Flex>
  ),
};

export const OneClosed: Story = {
  render: () => (
    <Flex h="full" direction="column">
      <HStack h="2rem" px="xs" justify="flex-end" borderBottomWidth="1px" borderColor="border">
        <PanelMenuToggle aria-label="Open Properties" icon={<SlidersHorizontal size={12} />} />
      </HStack>
      <Flex flex="1" minH="0">
        <PanelMenu title="Files" icon={<Paperclip size={12} />} side="left">
          <MenuBody label="Context files" />
        </PanelMenu>
        <PanelContent />
      </Flex>
    </Flex>
  ),
};

const ReattachPanelMenu = () => {
  const [attached, setAttached] = useState(false);

  return (
    <Flex h="full" direction="column" position="relative">
      <HStack h="2rem" px="xs" justify="flex-end" borderBottomWidth="1px" borderColor="border">
        {!attached ? <PanelMenuToggle aria-label="Open Files" icon={<Paperclip size={12} />} open /> : null}
        <PanelMenuToggle aria-label="Open Properties" icon={<SlidersHorizontal size={12} />} />
      </HStack>
      <Flex flex="1" minH="0">
        <PanelContent />
        {attached ? (
          <PanelMenu title="Files" icon={<Paperclip size={12} />} side="right">
            <MenuBody label="Context files" />
          </PanelMenu>
        ) : null}
      </Flex>
      {!attached ? (
        <Box position="absolute" top="2rem" right="xs">
          <PanelMenu
            title="Files"
            icon={<Paperclip size={12} />}
            variant="dropdown"
            side="right"
            onReattach={() => setAttached(true)}
          >
            <MenuBody label="Context files" />
          </PanelMenu>
        </Box>
      ) : null}
    </Flex>
  );
};

export const BothClosedWithDropdown: Story = {
  render: () => <ReattachPanelMenu />,
};
