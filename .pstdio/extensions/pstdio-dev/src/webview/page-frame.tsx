import { Flex, HStack } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ReactNode } from "react";

interface PageFrameProps {
  toolbar?: ReactNode;
  children: ReactNode;
  /** Shared horizontal and vertical padding for the page toolbar. */
  headerPadding?: "xs" | "sm" | "md" | "lg";
  /** Padding around the scrolled page content. */
  contentPadding?: "none" | "sm" | "md" | "lg";
}

// The toolbar sits outside the scroll area, so filters and actions stay in view while results scroll.
export const PageFrame = (props: PageFrameProps) => {
  const { toolbar, children, headerPadding, contentPadding = "lg" } = props;
  return (
    <Flex direction="column" h="full" minH="0">
      {toolbar ? (
        <HStack
          gap="sm"
          px={headerPadding ?? "lg"}
          py={headerPadding ?? "sm"}
          flexShrink={0}
          flexWrap="wrap"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          {toolbar}
        </HStack>
      ) : null}
      <ScrollArea flex="1" minH="0">
        <Flex direction="column" gap="lg" p={contentPadding} maxW="7xl" mx="auto" w="full">
          {children}
        </Flex>
      </ScrollArea>
    </Flex>
  );
};
