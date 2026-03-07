import { Box, Collapsible, Flex, Menu, Stack, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface ItemSectionProps {
  children: ReactNode;
  title?: string;
  defaultOpen?: boolean;
  action?: ReactNode;
}

/**
 * A collapsible component that displays a section of items (typically MenuItems).
 */
export const ItemSection = (props: ItemSectionProps) => {
  const { children, title, defaultOpen = true, action } = props;

  return (
    <Collapsible.Root defaultOpen={defaultOpen} width="full">
      <Flex>
        <Collapsible.Trigger
          _hover={{
            background: "bg.muted",
          }}
          borderRadius={"xs"}
          padding="sm"
          height="2rem"
          display="flex"
          width="full"
          gap="2"
          alignItems="center"
          cursor="pointer"
          justifyContent="space-between"
        >
          {title && (
            <Text fontWeight="600" textStyle="label/S/medium">
              {title}
            </Text>
          )}
          <Collapsible.Indicator transition="transform 0.2s" _open={{ transform: "rotate(90deg)" }}>
            <ChevronRight size={16} />
          </Collapsible.Indicator>
        </Collapsible.Trigger>
        {action && (
          <Box marginLeft="auto" onClick={(e) => e.stopPropagation()}>
            {action}
          </Box>
        )}
      </Flex>
      <Collapsible.Content>
        <Menu.Root>
          <Stack gap="0" paddingLeft="xs" paddingY="xs">
            {children}
          </Stack>
        </Menu.Root>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
