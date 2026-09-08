import { Box, HStack, Icon, Kbd, Stack, Text } from "@chakra-ui/react";
import { Bell, Blocks, Navigation, Palette, Search } from "lucide-react";
import { useStoryStyles } from "./building-blocks";

const SERVICES = [
  {
    name: "Search",
    description: "Find commands and jump to what you need.",
    icon: Search,
    example: "Search your workbench",
    shortcut: true,
  },
  {
    name: "Notifications",
    description: "Know when work finishes or needs your attention.",
    icon: Bell,
    example: "Font build complete",
  },
  {
    name: "Navigation",
    description: "Open your tools and arrange them side by side.",
    icon: Navigation,
    example: "Font editor / Coding agents",
  },
  {
    name: "Extension management",
    description: "Install, enable, and manage the tools in your workbench.",
    icon: Blocks,
    example: "Font editor · Enabled",
  },
  {
    name: "Themes",
    description: "Give your tools a consistent look that feels like yours.",
    icon: Palette,
    example: "Light · Dark · Your own theme",
  },
];

export const WorkbenchServices = () => {
  const styles = useStoryStyles();
  return (
    <Box as="section" css={styles.section} aria-labelledby="plumbing-title">
      <Stack gap="sm">
        <Text id="plumbing-title" as="h2" textStyle="heading/M">
          The plumbing, included.
        </Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Every tool can use the same workbench essentials.
        </Text>
      </Stack>
      <Box>
        {SERVICES.map((service) => (
          <Box key={service.name} css={styles.service}>
            <Icon as={service.icon} boxSize="6" color="fg.muted" />
            <Stack gap="sm" minWidth="0">
              <Text as="h3" textStyle="heading/S">
                {service.name}
              </Text>
              <Text textStyle="paragraph/M/regular" color="fg.muted">
                {service.description}
              </Text>
              <HStack gap="sm" flexWrap="wrap">
                <Text textStyle="label/S/regular" color="fg.subtle">
                  {service.example}
                </Text>
                {service.shortcut && <Kbd>⌘ P</Kbd>}
              </HStack>
            </Stack>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
