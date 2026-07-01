import { Box, Code, HStack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { WorkbenchIcon } from "../../../react";

export const Panel = (props: { title: string; children: ReactNode; action?: ReactNode }) => {
  const { action, children, title } = props;

  return (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="sm" bg="bg.panel" minW="0" overflow="hidden">
      <HStack borderBottomWidth="1px" borderColor="border.subtle" gap="xs" minH="2.25rem" px="sm">
        <Text textStyle="label/S/medium" color="fg" flex="1" minW="0" truncate>
          {title}
        </Text>
        {action}
      </HStack>
      <Box p="sm">{children}</Box>
    </Box>
  );
};

export const Metric = (props: { label: string; value: number }) => {
  const { label, value } = props;

  return (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="sm" p="sm" minW="0">
      <Text textStyle="heading/M" color="fg">
        {value}
      </Text>
      <Text textStyle="label/XS/regular" color="fg.muted" truncate>
        {label}
      </Text>
    </Box>
  );
};

export const InventoryRow = (props: { icon: string; label: string; value: string }) => {
  const { icon, label, value } = props;

  return (
    <HStack gap="xs" minW="0" py="2xs">
      <WorkbenchIcon name={icon} size={14} color="fg.muted" />
      <Text textStyle="paragraph/S/regular" color="fg" flex="1" minW="0" truncate>
        {label}
      </Text>
      <Code colorPalette="gray" truncate>
        {value}
      </Code>
    </HStack>
  );
};
