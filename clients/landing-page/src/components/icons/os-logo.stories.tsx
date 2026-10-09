import { HStack, Icon, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { OSLogo, platformIcon } from "./os-logo";

const meta = {
  title: "Landing/OS logos",
  component: OSLogo,
  args: { platform: "macOS" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof OSLogo>;

export default meta;
type Story = StoryObj<typeof meta>;
export const MacOS: Story = {};
export const Windows: Story = { args: { platform: "Windows" } };
export const Linux: Story = { args: { platform: "Linux" } };
export const DownloadPlatforms: Story = {
  render: () => (
    <HStack gap="lg">
      {["macOS", "Windows", "Linux"].map((platform) => (
        <HStack key={platform} gap="xs">
          <Icon as={platformIcon(platform)} boxSize="icon-sm" />
          <Text textStyle="label/S/regular">{platform}</Text>
        </HStack>
      ))}
    </HStack>
  ),
};
