import { Badge, Box, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "../../react";

export const BoomboxNav = () => (
  <HStack h="full" px="md" justify="space-between">
    <HStack>
      <Box boxSize="7" borderRadius="full" bg="bg.accent-primary.default" display="grid" placeItems="center">
        <WorkbenchIcon name="Radio" color="fg.button.primary.default" />
      </Box>
      <Text textStyle="heading/S/semibold">Boombox</Text>
    </HStack>
    <HStack>
      <IconButton aria-label="Notifications" size="xs" variant="ghost">
        <WorkbenchIcon name="Bell" />
      </IconButton>
      <Badge colorPalette="green" borderRadius="full">
        Ari
      </Badge>
    </HStack>
  </HStack>
);

const railItems = [
  { label: "Home", icon: "Home" },
  { label: "Search", icon: "Search" },
  { label: "Your library", icon: "Library" },
  { label: "Liked songs", icon: "Heart" },
];

export const BoomboxRail = () => (
  <Stack h="full" py="sm" align="center" justify="space-between">
    <Stack align="center" gap="sm">
      <Box boxSize="9" borderRadius="full" bg="bg.accent-primary.default" display="grid" placeItems="center">
        <WorkbenchIcon name="Radio" color="fg.button.primary.default" size={18} />
      </Box>
      {railItems.map((item, index) => (
        <IconButton
          key={item.label}
          aria-label={item.label}
          aria-current={index === 2 ? "page" : undefined}
          size="sm"
          variant={index === 2 ? "subtle" : "ghost"}
        >
          <WorkbenchIcon name={item.icon} />
        </IconButton>
      ))}
    </Stack>
    <Box boxSize="8" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
      <Text textStyle="paragraph/XS/semibold">AP</Text>
    </Box>
  </Stack>
);
