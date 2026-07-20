import type { ButtonProps } from "@chakra-ui/react";
import { Box, Button, ButtonGroup, HStack, Icon, IconButton, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Meta } from "@storybook/react";
import { ChevronDown, Download, Plus, Settings, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { getThemePreferenceClassNames, type ThemePreferenceMode } from "@/utils/apply-theme-preference";

type StoryFn = () => ReactNode;

interface ButtonVariantOption {
  label: string;
  description: string;
  variant: ButtonProps["variant"] | "primary" | "destructive";
}

interface ButtonSizeOption {
  label: string;
  helper: string;
  size: ButtonProps["size"];
}

interface ButtonModePreview {
  id: string;
  label: string;
  mode: ThemePreferenceMode;
}

const buttonVariants: ButtonVariantOption[] = [
  { label: "Primary", description: "Brand action style using accent tokens.", variant: "primary" },
  {
    label: "Destructive",
    description: "Filled destructive actions for delete and removal flows.",
    variant: "destructive",
  },
  { label: "Outline", description: "Neutral outlines for quiet actions.", variant: "outline" },
  { label: "Ghost", description: "Low emphasis actions in dense UI.", variant: "ghost" },
  { label: "Subtle", description: "Muted background actions with a light border.", variant: "subtle" },
  { label: "Plain", description: "Inline link-style actions.", variant: "plain" },
];

const buttonSizes: ButtonSizeOption[] = [
  { label: "2XS", helper: "Tiny icon controls in dense tables.", size: "2xs" },
  { label: "Extra Small", helper: "Compact inline controls.", size: "xs" },
  { label: "Small", helper: "Dense toolbars and tables.", size: "sm" },
  { label: "Medium", helper: "Default buttons across the app.", size: "md" },
  { label: "Large", helper: "Primary CTAs in dialogs.", size: "lg" },
  { label: "2XL", helper: "Hero CTAs on landing surfaces.", size: "2xl" },
];

const buttonModePreviews: ButtonModePreview[] = [
  { id: "pstdio-light", label: "Light mode", mode: "light" },
  { id: "pstdio-dark", label: "Dark mode", mode: "dark" },
];

const meta: Meta<typeof Button> = {
  title: "Components/Inputs/Button",
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
          borderColor="border.subtle"
          borderRadius="xs"
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

export const PrimaryAndDestructive = {
  render: () => (
    <SimpleGrid columns={{ base: 1, lg: 2 }} gap="md">
      {buttonModePreviews.map((surface) => (
        <Box
          key={surface.id}
          className={getThemePreferenceClassNames(surface.id, surface.mode).join(" ")}
          data-color-mode={surface.mode}
          data-theme={surface.id}
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xs"
          background="bg"
          padding="md"
        >
          <Stack gap="sm">
            <Text textStyle="label/L/medium">{surface.label}</Text>
            <HStack gap="sm" flexWrap="wrap">
              <Button variant="primary">Primary action</Button>
              <Button variant="primary" loading>
                Loading
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <Button variant="destructive">Delete item</Button>
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
          borderColor="border.subtle"
          borderRadius="xs"
          background="bg"
        >
          <Stack gap="xs" minWidth="12rem">
            <Text textStyle="label/L/medium">{size.label}</Text>
            <Text textStyle="label/XS" color="fg.muted">
              {size.helper}
            </Text>
          </Stack>

          <HStack gap="sm" flexWrap="wrap">
            <Button size={size.size} variant="primary">
              Create new
            </Button>
            <Button size={size.size} variant="outline">
              Outline
            </Button>
            <Button size={size.size} variant="ghost">
              <Icon as={Download} />
              Export
            </Button>
            <IconButton size={size.size} variant="ghost" aria-label="Settings">
              <Icon as={Settings} />
            </IconButton>
            <IconButton size={size.size} variant="destructive" aria-label="Delete">
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
    <HStack gap="sm" flexWrap="wrap" padding="md" borderWidth="1px" borderColor="border.subtle" borderRadius="xs">
      <IconButton variant="primary" aria-label="Add">
        <Icon as={Plus} boxSize="icon-sm" />
      </IconButton>
      <IconButton variant="subtle" aria-label="Settings">
        <Icon as={Settings} boxSize="16px" />
      </IconButton>
      <IconButton variant="outline" aria-label="Download">
        <Icon as={Download} boxSize="16px" />
      </IconButton>
      <IconButton variant="ghost" aria-label="Delete">
        <Icon as={Trash2} boxSize="16px" />
      </IconButton>
      <IconButton variant="ghost" aria-label="Open panel" aria-pressed="true">
        <Icon as={Settings} boxSize="16px" />
      </IconButton>
    </HStack>
  ),
};

export const AttachedGroups = {
  render: () => (
    <Stack gap="md" padding="md" borderWidth="1px" borderColor="border.subtle" borderRadius="xs" background="bg">
      <Text textStyle="label/L/medium">Flush button groups</Text>
      <HStack gap="sm" flexWrap="wrap">
        <ButtonGroup size="sm" variant="outline" attached>
          <Button variant="outline">Button</Button>
          <IconButton variant="outline" aria-label="More actions">
            <Icon as={ChevronDown} />
          </IconButton>
        </ButtonGroup>
        <ButtonGroup size="xs" variant="subtle" attached>
          <Button variant="subtle">Filter</Button>
          <IconButton variant="subtle" aria-label="Filter options">
            <Icon as={ChevronDown} />
          </IconButton>
        </ButtonGroup>
        <ButtonGroup size="2xs" variant="ghost" attached>
          <Button variant="ghost">Tiny</Button>
          <IconButton variant="ghost" aria-label="Tiny options">
            <Icon as={ChevronDown} />
          </IconButton>
        </ButtonGroup>
      </HStack>
    </Stack>
  ),
};
