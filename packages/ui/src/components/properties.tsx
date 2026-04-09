import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip";

export interface PropertyItem {
  label: string;
  description?: string;
  value: ReactNode;
}

export interface PropertiesProps {
  items: PropertyItem[];
}

/**
 * Displays a list of label–value property rows.
 *
 * Each property has a label, an optional description (shown as a tooltip), and a value (ReactNode).
 * All labels share a fixed width for alignment.
 *
 * Wrap with `<ItemSection>` when collapsible behavior is needed.
 */
export const Properties = (props: PropertiesProps) => {
  const { items } = props;

  return (
    <Stack gap="sm" paddingLeft="sm" paddingY="xs">
      {items.map((item, index) => (
        <HStack key={`${item.label}-${index}`} gap="xs" alignItems="center">
          <Box width="110px" flexShrink={0}>
            <HStack gap="1" alignItems="center">
              <Text textStyle="label/S/medium" color="fg.muted">
                {item.label}
              </Text>
              {item.description && (
                <Tooltip content={item.description} showArrow>
                  <Icon as={Info} boxSize="12px" color="fg.muted" opacity={0.6} cursor="help" />
                </Tooltip>
              )}
            </HStack>
          </Box>
          <Box flex="1">{item.value}</Box>
        </HStack>
      ))}
    </Stack>
  );
};
