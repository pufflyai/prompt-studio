import { Box, Button, Icon, IconButton, Input, Stack, Tabs, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Minus, MoreHorizontal, Plus, SquareArrowOutUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Header, type HeaderVariant } from "@/components/layout/header";
import { PANEL_HEADER_CONTROL_SIZE, PANEL_HEADER_TAB_SIZE } from "@/components/layout/panel-header.constants";

const meta = {
  title: "Components/Navigation/Header",
  component: Header,
  decorators: [
    (Story: () => ReactNode) => (
      <Box padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;

type Story = StoryObj<typeof meta>;

const variants: HeaderVariant[] = ["main", "narrow", "input"];

export const Variants: Story = {
  render: () => (
    <Stack gap="md">
      {variants.map((variant) => (
        <Header key={variant} variant={variant} background="bg.muted">
          {variant === "input" ? (
            <Input placeholder="Search tickets" size="sm" />
          ) : (
            <>
              <Text textStyle={variant === "narrow" ? "label/S/medium" : "label/M/medium"}>{variant}</Text>
              <Stack direction="row" gap="xs" marginInlineStart="auto">
                <Button size={variant === "narrow" ? "xs" : "sm"} variant="ghost">
                  Action
                </Button>
                <IconButton size={variant === "narrow" ? "xs" : "sm"} variant="ghost" aria-label="More actions">
                  <Icon as={MoreHorizontal} boxSize="16px" />
                </IconButton>
              </Stack>
            </>
          )}
        </Header>
      ))}
    </Stack>
  ),
};

export const SearchInput: Story = {
  render: () => (
    <Header variant="input" background="bg.muted">
      <Input placeholder="Filter results" size="sm" />
    </Header>
  ),
};

export const PanelControls: Story = {
  render: () => (
    <Header variant="narrow" background="bg.muted">
      <Tabs.Root defaultValue="workspaces" size={PANEL_HEADER_TAB_SIZE} variant="subtle">
        <Tabs.List>
          <Tabs.Trigger value="workspaces">Workspaces</Tabs.Trigger>
          <IconButton size={PANEL_HEADER_CONTROL_SIZE} variant="ghost" aria-label="Add panel">
            <Icon as={Plus} boxSize="14px" />
          </IconButton>
        </Tabs.List>
      </Tabs.Root>
      <IconButton size={PANEL_HEADER_CONTROL_SIZE} variant="ghost" aria-label="Attach panel">
        <Icon as={SquareArrowOutUpRight} boxSize="14px" />
      </IconButton>
      <IconButton size={PANEL_HEADER_CONTROL_SIZE} variant="ghost" aria-label="Minimize panel">
        <Icon as={Minus} boxSize="14px" />
      </IconButton>
    </Header>
  ),
};
