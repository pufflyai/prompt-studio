import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import type { ActivityFeedItem } from "./activity-feed";

interface ActivityFeedEntryProps {
  item: ActivityFeedItem;
}

export const ActivityFeedEntry = (props: ActivityFeedEntryProps) => {
  const { item } = props;

  return (
    <HStack align="start" gap="sm" paddingY="sm" borderBottomWidth="1px" borderColor="border.secondary">
      <Stack gap="2xs" flex="1" minW={0}>
        <Text textStyle="label/S/medium" color="foreground.primary">
          {item.title}
        </Text>
        <HStack gap="xs" minW={0} flexWrap="wrap">
          <Text textStyle="label/XS/regular" color="foreground.secondary">
            {item.resourceLabel}
          </Text>
          {!item.isKnownKernelResource ? (
            <Badge size="sm" variant="subtle">
              {item.resourceType}
            </Badge>
          ) : null}
          {item.sourceExtensionId ? (
            <Text textStyle="label/XS/regular" color="foreground.secondary">
              {item.sourceExtensionId}
            </Text>
          ) : null}
        </HStack>
      </Stack>
    </HStack>
  );
};
