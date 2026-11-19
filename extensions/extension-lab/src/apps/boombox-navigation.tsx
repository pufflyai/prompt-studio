import { Badge, Box, HStack, IconButton, Text } from "@chakra-ui/react";
import { ExampleIcon } from "../icon";
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
