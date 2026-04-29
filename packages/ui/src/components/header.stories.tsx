import { Box, Button, Icon, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Header, type HeaderVariant } from "./header";

const meta = {
  title: "Components/Header",
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
            <Input placeholder="Search tickets" height="full" borderWidth="0" borderRadius="0" />
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
      <Input placeholder="Filter results" height="full" borderWidth="0" borderRadius="0" />
    </Header>
  ),
};
