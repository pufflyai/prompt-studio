import { Flex, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchArea } from "../../../core";

const AreaPlaceholderContent = (props: { area: WorkbenchArea; uri: string; name: string }) => {
  const { area, name, uri } = props;

  return (
    <>
      <Text textStyle="label/M/medium" color="fg" truncate>
        {name}
      </Text>
      <Text as="code" textStyle="label/XS/regular" color="fg.muted" overflowWrap="anywhere">
        {uri}
      </Text>
      <Text as="code" textStyle="label/XS/regular" color="fg.subtle">
        {area}
      </Text>
    </>
  );
};

export const AreaPlaceholder = (props: { area: WorkbenchArea; uri: string; name: string }) => {
  const { area, name, uri } = props;

  if (area === "overlay") {
    return (
      <Flex h="full" w="full" p="xs" alignItems="center" justifyContent="center" pointerEvents="none">
        <Stack pointerEvents="auto" w="full">
          <AreaPlaceholderContent area={area} name={name} uri={uri} />
        </Stack>
      </Flex>
    );
  }

  if (area === "status") {
    return (
      <HStack h="full" minW="0" overflow="hidden" px="xs" gap="xs">
        <Text textStyle="label/XS/medium" color="fg" flexShrink={0}>
          {name}
        </Text>
        <Text as="code" textStyle="label/XS/regular" color="fg.muted" truncate>
          {uri}
        </Text>
      </HStack>
    );
  }

  const isHeaderArea =
    area === "top" ||
    area === "main-header" ||
    area === "left-header" ||
    area === "main-left-header" ||
    area === "main-right-header" ||
    area === "main-bottom-header" ||
    area === "floating-header";

  if (isHeaderArea) {
    return (
      <HStack h="full" minW="0" overflow="hidden" gap="xs" px="xs">
        <Text textStyle="label/S/medium" color="fg" flexShrink={0}>
          {name}
        </Text>
        <Text as="code" textStyle="label/XS/regular" color="fg.muted" truncate>
          {uri}
        </Text>
      </HStack>
    );
  }

  if (area === "activityBar") {
    return (
      <Flex h="full" w="full" alignItems="center" justifyContent="center" overflow="hidden" p="xs">
        <Stack alignItems="center" gap="xs" maxH="full" minW="0" overflow="hidden" css={{ writingMode: "vertical-rl" }}>
          <Text textStyle="label/XS/medium" color="fg" truncate>
            {name}
          </Text>
          <Text as="code" textStyle="label/XS/regular" color="fg.muted" truncate>
            {uri}
          </Text>
        </Stack>
      </Flex>
    );
  }

  return (
    <Stack h="full" minH="0" minW="0" justifyContent="center" gap="2xs" overflow="hidden" p="md">
      <AreaPlaceholderContent area={area} name={name} uri={uri} />
    </Stack>
  );
};
