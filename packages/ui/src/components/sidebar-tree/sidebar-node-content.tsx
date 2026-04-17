import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { Tooltip } from "../tooltip";
import type { SidebarNode } from "./sidebar-tree.types";

interface SidebarNodeContentProps {
  node: SidebarNode;
  expanded: boolean;
  hasChildren: boolean;
  isDisabled: boolean;
}

export const SidebarNodeContent = (props: SidebarNodeContentProps) => {
  const { node, expanded, hasChildren, isDisabled } = props;

  return (
    <HStack gap="2" minW="0" flex="1" overflow="hidden">
      {node.icon ? (
        <Box color={node.iconColor ?? "fg.muted"} flexShrink={0}>
          {node.icon}
        </Box>
      ) : null}
      <Stack gap="0" minW="0" flex="1">
        <HStack gap="1" minW="0">
          {typeof node.label === "string" ? (
            <Text textStyle="paragraph/S/regular" color={isDisabled ? "fg.muted" : "fg"} truncate>
              {node.label}
            </Text>
          ) : (
            <Box minW="0" maxW="full" overflow="hidden">
              {node.label}
            </Box>
          )}
          {node.indicator ? (
            <Tooltip content={node.indicator.tooltip} disabled={!node.indicator.tooltip} openDelay={300}>
              <Box color={node.indicator.color ?? "fg.muted"} flexShrink={0}>
                {node.indicator.icon}
              </Box>
            </Tooltip>
          ) : null}
          {hasChildren ? (
            <Box color="fg.muted" flexShrink={0}>
              <ChevronRight
                size={14}
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "120ms" }}
              />
            </Box>
          ) : null}
        </HStack>
        {node.description ? (
          typeof node.description === "string" ? (
            <Text textStyle="paragraph/XS/regular" color="fg.muted" truncate>
              {node.description}
            </Text>
          ) : (
            <Box minW="0" maxW="full" overflow="hidden">
              {node.description}
            </Box>
          )
        ) : null}
      </Stack>
    </HStack>
  );
};
