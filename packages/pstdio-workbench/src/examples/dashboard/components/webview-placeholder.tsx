import { Badge, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "../../../react";

const SlotChip = (props: { slotId: string }) => {
  const { slotId } = props;

  return (
    <Text textStyle="paragraph/XS/regular" color="fg.muted" fontFamily="mono" flexShrink={0}>
      {slotId}
    </Text>
  );
};

export const WebviewPlaceholder = (props: {
  slotId: string;
  title: string;
  contributor: string;
  entry: string;
  icon: string;
  height?: string;
}) => {
  const { contributor, entry, height, icon, slotId, title } = props;

  return (
    <Stack
      gap="0"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.emphasis"
      borderRadius="sm"
      bg="bg.subtle"
      h={height}
      minH="0"
      overflow="hidden"
    >
      <HStack px="sm" py="2xs" borderBottomWidth="1px" borderColor="border.muted" bg="bg" gap="xs">
        <Text textStyle="label/S/medium" flex="1" minW="0" truncate>
          {title}
        </Text>
        <Badge size="xs" variant="outline">
          {contributor}
        </Badge>
        <SlotChip slotId={slotId} />
      </HStack>
      <Flex flex="1" minH="0" align="center" justify="center" direction="column" gap="2xs" p="md">
        <WorkbenchIcon name={icon} size={24} color="fg.muted" />
        <Text textStyle="paragraph/XS/regular" color="fg.muted" fontFamily="mono">
          iframe: {entry}
        </Text>
      </Flex>
    </Stack>
  );
};
