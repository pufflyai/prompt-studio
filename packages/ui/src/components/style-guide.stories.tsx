import { Box, Button, HStack, Menu, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { FileText, Folder, Settings } from "lucide-react";
import type { ReactNode } from "react";

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
    label: "Hover background",
    token: "bg.hover",
    description: "Shared hover state for lists, actions, and rows.",
  },
  {
    label: "Active background",
    token: "bg.active",
    description: "Shared selected and active state surface.",
  },
  {
    label: "Muted background",
    token: "bg.muted",
    description: "Secondary panel and card surface.",
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

const DarkModeSelectionContrastStory = () => (
  <Box
    borderWidth="1px"
    borderColor="border.muted"
    borderRadius="md"
    background="bg.dark"
    color="fg.inverted"
    padding="md"
  >
    <Stack gap="sm">
      <Text textStyle="heading/S">Dark mode text selection</Text>
      <Text textStyle="paragraph/S/regular">
        Select this sentence to preview the global `::selection` contrast update in dark mode.
      </Text>
    </Stack>
  </Box>
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

export const DarkModeTextSelection = {
  name: "Dark mode text selection",
  render: () => <DarkModeSelectionContrastStory />,
  parameters: {
    themes: {
      themeOverride: "dark",
    },
  },
};
