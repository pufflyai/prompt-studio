import { Flex, HStack } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ReactNode } from "react";

interface PageFrameProps {
  toolbar: ReactNode;
  children: ReactNode;
}

// The toolbar sits outside the scroll area, so filters and actions stay in view while results scroll.
export const PageFrame = (props: PageFrameProps) => {
  const { toolbar, children } = props;
  return (
    <Flex direction="column" h="full" minH="0">
      <HStack
        gap="sm"
        px="lg"
        py="sm"
        flexShrink={0}
        flexWrap="wrap"
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
        {toolbar}
      </HStack>
      <ScrollArea flex="1" minH="0">
        <Flex direction="column" gap="lg" p="lg" maxW="7xl" mx="auto" w="full">
          {children}
        </Flex>
      </ScrollArea>
    </Flex>
  );
};
