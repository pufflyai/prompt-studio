import { Flex, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchArea } from "../../../core";

interface AreaMapPlaceholderProps {
  area: WorkbenchArea;
  role: string;
  uri: string;
  name: string;
}

const AreaMapPlaceholderContent = (props: { name: string; role: string; uri: string }) => {
  const { name, role, uri } = props;

  return (
    <>
      <Text textStyle="label/M/medium" color="fg" truncate>
        {name}
      </Text>
      <Text textStyle="label/XS/medium" color="fg.muted" overflowWrap="anywhere">
        {role}
      </Text>
      <Text as="code" textStyle="label/XS/regular" color="fg.subtle" overflowWrap="anywhere">
        {uri}
      </Text>
    </>
  );
};

// A compact single-line label for the thin strips (headers, status, chrome) where the
// role matters more than the uri.
const AreaMapPlaceholderStrip = (props: { name: string; role: string }) => {
  const { name, role } = props;

  return (
    <HStack h="full" minW="0" overflow="hidden" gap="xs" px="xs">
      <Text textStyle="label/S/medium" color="fg" flexShrink={0}>
        {name}
      </Text>
      <Text textStyle="label/XS/regular" color="fg.muted" truncate>
        {role}
      </Text>
    </HStack>
  );
};

export const AreaMapPlaceholder = (props: AreaMapPlaceholderProps) => {
  const { area, name, role, uri } = props;

  if (area === "overlay") {
    return (
      <Flex h="full" w="full" p="xs" alignItems="center" justifyContent="center" pointerEvents="none">
        <Stack pointerEvents="auto" w="full">
          <AreaMapPlaceholderContent name={name} role={role} uri={uri} />
        </Stack>
      </Flex>
    );
  }

  if (area === "status") {
    return <AreaMapPlaceholderStrip name={name} role={role} />;
  }

  const isHeaderArea =
    area === "nav" ||
    area === "main-header" ||
    area === "left-header" ||
    area === "secondary-header" ||
    area === "floating-header";

  if (isHeaderArea) {
    return <AreaMapPlaceholderStrip name={name} role={role} />;
  }

  if (area === "activity") {
    return (
      <Flex h="full" w="full" alignItems="center" justifyContent="center" overflow="hidden" p="xs">
        <Stack alignItems="center" gap="xs" maxH="full" minW="0" overflow="hidden" css={{ writingMode: "vertical-rl" }}>
          <Text textStyle="label/XS/medium" color="fg" truncate>
            {name}
          </Text>
          <Text textStyle="label/XS/regular" color="fg.muted" truncate>
            {role}
          </Text>
        </Stack>
      </Flex>
    );
  }

  return (
    <Stack h="full" minH="0" minW="0" justifyContent="center" gap="2xs" overflow="hidden" p="md">
      <AreaMapPlaceholderContent name={name} role={role} uri={uri} />
    </Stack>
  );
};
