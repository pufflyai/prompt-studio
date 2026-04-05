import { Box, Button, HStack, Menu, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { FileText, Folder, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { expect, within } from "storybook/test";

import { MenuItem } from "./menu-item";
import { StyleGuide } from "./style-guide";

type StoryFn = () => ReactNode;

interface SurfaceToken {
  label: string;
  token: string;
  description: string;
  foreground?: string;
}

const surfaceTokens: SurfaceToken[] = [
  {
    label: "Base background",
    token: "bg",
    description: "Default canvas for pages and cards.",
  },
  {
    label: "Subtle background",
    token: "bg.subtle",
    description: "Quiet nesting surface for supporting sections.",
  },
  {
    label: "Muted background",
    token: "bg.muted",
    description: "Selected, hovered, or emphasized page backplate.",
  },
  {
    label: "Panel background",
    token: "bg.panel",
    description: "Persistent navigation and utility surfaces.",
  },
  {
    label: "Dark background",
    token: "bg.dark",
    description: "High-contrast backdrop for elevated layers.",
    foreground: "fg.inverted",
  },
];

const SurfaceMenuPreview = () => (
  <Menu.Root>
    <Stack
      gap="2px"
      padding="xs"
      borderRadius="sm"
      borderWidth="1px"
      borderColor="border.muted"
      background="bg"
      boxShadow="low"
    >
      <MenuItem id="overview" primaryLabel="Overview" secondaryLabel="Workspace summary" leftIcon={FileText} />
      <MenuItem
        id="activity"
        primaryLabel="Recent activity"
        secondaryLabel="Deploys and review notes"
        leftIcon={Folder}
        isSelected
      />
      <MenuItem id="settings" primaryLabel="Settings" secondaryLabel="Alerts and access" leftIcon={Settings} />
    </Stack>
  </Menu.Root>
);

const SurfaceModalPreview = () => (
  <Box layerStyle="modal">
    <Stack gap="sm">
      <Stack gap="2xs">
        <Text textStyle="label/L/medium">Modal surface</Text>
        <Text textStyle="label/XS" color="fg.muted">
          Elevated content stays on the default surface even when the page background shifts.
        </Text>
      </Stack>

      <HStack gap="sm" flexWrap="wrap">
        <Button size="sm" variant="outline">
          Cancel
        </Button>
        <Button size="sm" variant="primary">
          Publish
        </Button>
      </HStack>
    </Stack>
  </Box>
);

interface SurfaceCompositionCardProps {
  surface: SurfaceToken;
}

const SurfaceCompositionCard = (props: SurfaceCompositionCardProps) => {
  const { surface } = props;
  const foreground = surface.foreground ?? "fg";

  return (
    <Box
      borderWidth="1px"
      borderColor="border.muted"
      borderRadius="md"
      background={surface.token}
      color={foreground}
      padding="md"
      minHeight="100%"
    >
      <Stack gap="md">
        <Stack gap="2xs">
          <Text textStyle="label/L/medium">{surface.label}</Text>
          <Text textStyle="label/XS" color={foreground} opacity={0.72}>
            {surface.token}
          </Text>
          <Text textStyle="paragraph/XS/regular" color={foreground} opacity={0.8}>
            {surface.description}
          </Text>
        </Stack>

        <HStack gap="sm" flexWrap="wrap">
          <Button size="sm" variant="primary">
            Primary action
          </Button>
          <Button size="sm" variant="outline">
            Secondary
          </Button>
          <Button size="sm" variant="subtle">
            Subtle
          </Button>
        </HStack>

        <Stack gap="xs">
          <Text textStyle="label/S/medium" color={foreground}>
            Menu surface
          </Text>
          <SurfaceMenuPreview />
        </Stack>

        <Stack gap="xs">
          <Text textStyle="label/S/medium" color={foreground}>
            Modal surface
          </Text>
          <SurfaceModalPreview />
        </Stack>
      </Stack>
    </Box>
  );
};

const SurfaceCompositionsStory = () => (
  <Stack gap="lg">
    <Stack gap="xs">
      <Text textStyle="heading/M">Surface compositions</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Compare the core page backgrounds with buttons, menus, and modal surfaces layered on top.
      </Text>
    </Stack>

    <SimpleGrid columns={{ base: 1, xl: 2 }} gap="md">
      {surfaceTokens.map((surfaceToken) => (
        <SurfaceCompositionCard key={surfaceToken.token} surface={surfaceToken} />
      ))}
    </SimpleGrid>
  </Stack>
);

const meta = {
  title: "Foundations/Style Guide",
  decorators: [
    (Story: StoryFn) => (
      <Box height="100vh" background="bg" overflowY="auto" overflowX="hidden">
        <Box padding="sm">
          <Story />
        </Box>
      </Box>
    ),
  ],
};

export default meta;

export const Overview = {
  render: () => <StyleGuide />,
};

export const SurfaceCompositions = {
  name: "Surface compositions",
  render: () => <SurfaceCompositionsStory />,
};

export const AccentPrimaryShades = {
  name: "Accent Primary Shades",
  render: () => (
    <Stack gap="sm">
      <Text textStyle="label/L/medium">Accent primary token comparison</Text>
      <SimpleGrid columns={2} gap="sm">
        <Stack gap="xs">
          <Text textStyle="label/XS">bg.accent-primary.medium</Text>
          <Box
            data-testid="accent-primary-medium"
            borderRadius="sm"
            height="56px"
            background="bg.accent-primary.medium"
          />
        </Stack>
        <Stack gap="xs">
          <Text textStyle="label/XS">bg.accent-primary.dark</Text>
          <Box data-testid="accent-primary-dark" borderRadius="sm" height="56px" background="bg.accent-primary.dark" />
        </Stack>
      </SimpleGrid>
      <Box
        data-testid="accent-primary-contrast-surface"
        borderRadius="sm"
        padding="sm"
        background="bg.accent-primary.medium"
        color="red.500"
      >
        <Text data-testid="accent-primary-contrast-text" textStyle="label/XS" color="text.selectable.primary">
          text.selectable.primary
        </Text>
      </Box>
    </Stack>
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const medium = canvas.getByTestId("accent-primary-medium");
    const dark = canvas.getByTestId("accent-primary-dark");
    const contrastText = canvas.getByTestId("accent-primary-contrast-text");

    const mediumBackgroundColor = getComputedStyle(medium).backgroundColor;
    const darkBackgroundColor = getComputedStyle(dark).backgroundColor;
    const contrastTextColor = getComputedStyle(contrastText).color;

    await expect(darkBackgroundColor).not.toBe(mediumBackgroundColor);
    await expect(contrastTextColor).toBe("rgb(34, 37, 44)");
  },
};

export const InputsNoShadow = {
  name: "Inputs No Shadow",
  render: () => <StyleGuide />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Company name");
    const textarea = canvas.getByPlaceholderText("Notes");

    const inputStyles = getComputedStyle(input);
    const textareaStyles = getComputedStyle(textarea);

    await expect(inputStyles.boxShadow).toBe("none");
    await expect(textareaStyles.boxShadow).toBe("none");
  },
};
