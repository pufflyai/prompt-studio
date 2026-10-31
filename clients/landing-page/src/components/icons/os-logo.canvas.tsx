import { HStack, Icon, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { OSLogo, platformIcon } from "./os-logo";

const meta = {
  title: "Landing/OS logos",
  component: OSLogo,
  args: { platform: "macOS" },
} satisfies CanvasMeta<typeof OSLogo>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const MacOS: Story = {
  id: "landing-os-logos--mac-os",
};
export const Windows: Story = {
  id: "landing-os-logos--windows",
  args: { platform: "Windows" },
};
export const Linux: Story = {
  id: "landing-os-logos--linux",
  args: { platform: "Linux" },
};
export const DownloadPlatforms: Story = {
  id: "landing-os-logos--download-platforms",
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
