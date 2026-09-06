import { Badge, Box, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { createExampleStore, useExampleStore } from "../example-store";
import { ExampleIcon } from "../icon";
import { exampleDefaults } from "../state-defaults";
import { BackToProject } from "./back-to-project";

export const BoomboxNav = () => (
  <HStack h="full" px="md" gap="md">
    <BackToProject />
    <HStack>
      <Box boxSize="7" borderRadius="full" bg="bg.accent-primary.default" display="grid" placeItems="center">
        <ExampleIcon name="Radio" color="fg.button.primary.default" />
      </Box>
      <Text textStyle="heading/S/semibold">Boombox</Text>
    </HStack>
    <HStack>
      <IconButton aria-label="Notifications" disabled size="xs" variant="ghost">
        <ExampleIcon name="Bell" />
      </IconButton>
      <Badge colorPalette="green" borderRadius="full">
        Ari
      </Badge>
    </HStack>
  </HStack>
);

const railItems = [
  { label: "Home", icon: "House" },
  { label: "Search", icon: "Search" },
  { label: "Your library", icon: "Library" },
  { label: "Liked songs", icon: "Heart" },
];

export const boomboxNavigationStore = createExampleStore("boombox", exampleDefaults.boombox);
export const BoomboxRail = () => {
  const state = useExampleStore(boomboxNavigationStore);
  return (
    <Stack h="full" py="sm" align="center" justify="space-between">
      <Stack align="center" gap="sm">
        <Box boxSize="9" borderRadius="full" bg="bg.accent-primary.default" display="grid" placeItems="center">
          <ExampleIcon name="Radio" color="fg.button.primary.default" size={18} />
        </Box>
        {railItems.map((item) => (
          <IconButton
            key={item.label}
            aria-label={item.label}
            onClick={() => boomboxNavigationStore.setState({ filter: item.label, query: "" })}
            aria-current={state.filter === item.label ? "page" : undefined}
            size="sm"
            variant={state.filter === item.label ? "subtle" : "ghost"}
          >
            <ExampleIcon name={item.icon} />
          </IconButton>
        ))}
      </Stack>
      <Box boxSize="8" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
        <Text textStyle="paragraph/XS/semibold">AP</Text>
      </Box>
    </Stack>
  );
};
