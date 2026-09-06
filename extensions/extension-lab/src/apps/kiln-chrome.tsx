import { Box, HStack, Text } from "@chakra-ui/react";
import { usePageResource } from "../example-store";
import { ExampleIcon } from "../icon";
import type { ExampleHost } from "../view-context";
import { BackToProject } from "./back-to-project";
import { kilnObjects } from "./kiln-data";

export const KilnNav = () => (
  <HStack h="full" px="md" gap="md">
    <BackToProject />
    <HStack gap="xs">
      <Box boxSize="7" borderRadius="sm" bg="bg.accent-primary.default" display="grid" placeItems="center">
        <ExampleIcon name="Box" color="fg.button.primary.default" />
      </Box>
      <Text textStyle="heading/S/semibold">Kiln</Text>
    </HStack>
    <Box h="4" borderLeftWidth="1px" borderColor="border.subtle" />
    <Text textStyle="paragraph/S/medium">Clay Study</Text>
  </HStack>
);

export const KilnStatus = (props: { host: ExampleHost }) => {
  const { host } = props;
  const selectedId = usePageResource(host)?.id;
  const selected = kilnObjects.find((object) => object.id === selectedId) ?? kilnObjects[0];
  return (
    <HStack h="full" px="sm" gap="md">
      <HStack gap="xs">
        <ExampleIcon name={selected.icon} size={12} />
        <Text textStyle="paragraph/XS/regular">{selected.name}</Text>
      </HStack>
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        4 objects
      </Text>
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        Drag to orbit · Scroll to zoom
      </Text>
    </HStack>
  );
};
