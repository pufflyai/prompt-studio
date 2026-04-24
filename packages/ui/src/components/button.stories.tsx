import type { ButtonProps } from "@chakra-ui/react";
import { Box, Button, HStack, Icon, IconButton, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Download, Plus, Settings, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

type StoryFn = () => ReactNode;

interface ButtonVariantOption {
  label: string;
  description: string;
  variant: ButtonProps["variant"] | "primary";
}

interface ButtonSizeOption {
  label: string;
  helper: string;
  size: ButtonProps["size"];
}

const buttonVariants: ButtonVariantOption[] = [
  { label: "Primary", description: "Brand action style using accent tokens.", variant: "primary" },
  { label: "Solid", description: "Primary calls to action.", variant: "solid" },
  { label: "Surface", description: "Secondary surfaces with borders.", variant: "surface" },
  { label: "Outline", description: "Neutral outlines for quiet actions.", variant: "outline" },
  { label: "Ghost", description: "Low emphasis actions in dense UI.", variant: "ghost" },
  { label: "Subtle", description: "Low-contrast background actions.", variant: "subtle" },
  { label: "Plain", description: "Inline link-style actions.", variant: "plain" },
];

const buttonSizes: ButtonSizeOption[] = [
  { label: "Extra Small", helper: "Compact inline controls.", size: "xs" },
  { label: "Small", helper: "Dense toolbars and tables.", size: "sm" },
  { label: "Medium", helper: "Default buttons across the app.", size: "md" },
  { label: "Large", helper: "Primary CTAs in dialogs.", size: "lg" },
  { label: "2XL", helper: "Hero CTAs on landing surfaces.", size: "2xl" },
];

const meta = {
  title: "Components/Button",
  component: Button,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const Variants = {
  render: () => (
    <SimpleGrid columns={{ base: 1, lg: 2 }} gap="md">
      {buttonVariants.map((variant) => (
        <Box
          key={variant.label}
          borderWidth="1px"
          borderColor="border.muted"
          borderRadius="md"
          background="bg"
          padding="md"
        >
          <Stack gap="sm">
            <Stack gap="xs">
              <Text textStyle="label/L/medium">{variant.label}</Text>
              <Text textStyle="label/XS" color="fg.muted">
                {variant.description}
              </Text>
            </Stack>

            <HStack gap="sm" flexWrap="wrap">
              <Button variant={variant.variant as ButtonProps["variant"]}>Run action</Button>
              <Button variant={variant.variant as ButtonProps["variant"]} loading>
                Loading
              </Button>
              <Button variant={variant.variant as ButtonProps["variant"]} disabled>
                Disabled
              </Button>
            </HStack>
          </Stack>
        </Box>
      ))}
    </SimpleGrid>
  ),
};

export const Sizes = {
  render: () => (
    <Stack gap="lg">
      {buttonSizes.map((size) => (
        <HStack
          key={size.label}
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap="md"
          padding="md"
          borderWidth="1px"
          borderColor="border.muted"
          borderRadius="md"
          background="bg"
        >
          <Stack gap="xs" minWidth="12rem">
            <Text textStyle="label/L/medium">{size.label}</Text>
            <Text textStyle="label/XS" color="fg.muted">
              {size.helper}
            </Text>
          </Stack>

          <HStack gap="sm" flexWrap="wrap">
            <Button size={size.size} variant="solid">
              Create new
            </Button>
            <Button size={size.size} variant="outline">
              Secondary
            </Button>
            <Button size={size.size} variant="ghost">
              <Icon as={Download} />
              Export
            </Button>
            <IconButton size={size.size} variant="ghost" aria-label="Settings">
              <Icon as={Settings} />
            </IconButton>
            <IconButton size={size.size} variant="outline" aria-label="Delete">
              <Icon as={Trash2} />
            </IconButton>
          </HStack>
        </HStack>
      ))}
    </Stack>
  ),
};

export const IconOnly = {
  render: () => (
    <HStack gap="sm" flexWrap="wrap" padding="md" borderWidth="1px" borderColor="border.muted" borderRadius="md">
      <IconButton variant="solid" aria-label="Add">
        <Icon as={Plus} boxSize="icon-sm" />
      </IconButton>
      <IconButton variant="surface" aria-label="Settings">
        <Icon as={Settings} boxSize="16px" />
      </IconButton>
      <IconButton variant="outline" aria-label="Download">
        <Icon as={Download} boxSize="16px" />
      </IconButton>
      <IconButton variant="ghost" aria-label="Delete">
        <Icon as={Trash2} boxSize="16px" />
      </IconButton>
    </HStack>
  ),
};
