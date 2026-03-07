import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { expect, within } from "storybook/test";

import { StyleGuide } from "./style-guide";

type StoryFn = () => ReactNode;

interface ColorToken {
  label: string;
  token: string;
}

const backgroundTokens: ColorToken[] = [
  { label: "Background primary", token: "bg" },
  { label: "Background secondary", token: "bg.muted" },
  { label: "Background subtle", token: "bg.subtle" },
  { label: "Background active", token: "bg.emphasized" },
  { label: "Background hover", token: "bg.muted" },
  { label: "Background inverse", token: "bg.inverted" },
  { label: "Background dark", token: "bg.dark" },
  { label: "Background white", token: "bg.white" },
  { label: "Background light", token: "bg.panel" },
  { label: "Background display very light", token: "bg.display.very-light" },

  { label: "Accent primary very light", token: "bg.accent-primary.very-light" },
  { label: "Accent primary light", token: "bg.accent-primary.light" },
  { label: "Accent primary medium", token: "bg.accent-primary.medium" },
  { label: "Accent primary dark", token: "bg.accent-primary.dark" },

  { label: "Accent secondary grey dark", token: "bg.accent-secondary.grey-dark" },
  { label: "Accent secondary grey light", token: "bg.accent-secondary.grey-light" },
  { label: "Accent secondary red very light", token: "bg.accent-secondary.red-very-light" },
  { label: "Accent secondary red light", token: "bg.accent-secondary.red-light" },
  { label: "Accent secondary pink light", token: "bg.accent-secondary.pink-light" },
  { label: "Accent secondary pink medium", token: "bg.accent-secondary.pink-medium" },
  { label: "Accent secondary blue very light", token: "bg.accent-secondary.blue-very-light" },
  { label: "Accent secondary blue light", token: "bg.accent-secondary.blue-light" },
  { label: "Accent secondary blue medium", token: "bg.accent-secondary.blue-medium" },
  { label: "Accent secondary blue dark", token: "bg.accent-secondary.blue-dark" },
  { label: "Accent secondary cyan light", token: "bg.accent-secondary.cyan-light" },
  { label: "Accent secondary green light", token: "bg.accent-secondary.green-light" },
  { label: "Accent secondary yellow light", token: "bg.accent-secondary.yellow-light" },
  { label: "Accent secondary yellow medium", token: "bg.accent-secondary.yellow-medium" },
  { label: "Accent secondary sand light", token: "bg.accent-secondary.sand-light" },
];

const foregroundTokens: ColorToken[] = [
  { label: "Foreground primary", token: "fg" },
  { label: "Foreground secondary", token: "fg.muted" },
  { label: "Foreground tertiary", token: "fg.subtle" },
  { label: "Foreground inverse", token: "fg.inverted" },
  { label: "Foreground feedback success", token: "fg.success" },
  { label: "Foreground feedback alert", token: "fg.error" },
  { label: "Foreground accent pink dark", token: "fg.accent.pink-dark" },
  { label: "Foreground green dark", token: "fg.green-dark" },
  { label: "Foreground blue dark", token: "fg.blue-dark" },
  { label: "Foreground blue very dark", token: "fg.blue-very-dark" },
];

interface ColorCombinationTileProps {
  background: ColorToken;
  foreground: ColorToken;
}

const ColorCombinationTile = (props: ColorCombinationTileProps) => {
  const { background, foreground } = props;

  return (
    <Box background="bg" borderWidth="1px" borderColor="border.muted" borderRadius="sm" overflow="hidden">
      <Box padding="sm" background={background.token} color={foreground.token} minHeight="96px">
        <Stack gap="2xs">
          <Text textStyle="label/M/medium">Aa</Text>
          <Text textStyle="paragraph/XS/regular">Sample text</Text>
        </Stack>
      </Box>

      <Box padding="sm">
        <Stack gap="2xs">
          <Text textStyle="label/XS" color="fg">
            {foreground.label}
          </Text>
          <Text textStyle="label/XS" color="fg.muted">
            {foreground.token}
          </Text>
        </Stack>
      </Box>
    </Box>
  );
};

interface BackgroundForegroundCardProps {
  background: ColorToken;
}

const BackgroundForegroundCard = (props: BackgroundForegroundCardProps) => {
  const { background } = props;

  return (
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" background="bg" padding="md">
      <Stack gap="sm">
        <Stack gap="2xs">
          <Text textStyle="label/L/medium">{background.label}</Text>
          <Text textStyle="label/XS" color="fg.muted">
            {background.token}
          </Text>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="sm">
          {foregroundTokens.map((foreground) => (
            <ColorCombinationTile
              key={`${background.token}-${foreground.token}`}
              background={background}
              foreground={foreground}
            />
          ))}
        </SimpleGrid>
      </Stack>
    </Box>
  );
};

const BackgroundForegroundStory = () => (
  <Stack gap="lg">
    <Stack gap="xs">
      <Text textStyle="heading/M">Background and foreground permutations</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Every background token combined with each foreground text color to check legibility.
      </Text>
    </Stack>

    <SimpleGrid columns={{ base: 1, xl: 2 }} gap="md">
      {backgroundTokens.map((backgroundToken) => (
        <BackgroundForegroundCard key={backgroundToken.token} background={backgroundToken} />
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

export const BackgroundForegroundPermutations = {
  name: "Background x foreground",
  render: () => <BackgroundForegroundStory />,
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
