import { Box, Stack } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ReactNode } from "react";

interface PageContentLayoutProps {
  header: ReactNode;
  children: ReactNode;
  testId?: string;
}

/** A page owns its body viewport; controls in its header remain reachable during scrolling. */
export const PageContentLayout = (props: PageContentLayoutProps) => {
  const { header, children, testId } = props;
  return (
    <Stack h="full" minH="0" gap="0" overflow="hidden" contain="size" data-testid={testId}>
      <Box flexShrink="0">{header}</Box>
      <ScrollArea flex="1" minH="0" contentProps={{ paddingBottom: "lg" }} data-testid="page-body-scroll">
        {children}
      </ScrollArea>
    </Stack>
  );
};
