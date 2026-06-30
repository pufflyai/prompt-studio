import { Stack } from "@chakra-ui/react";
import { EmptyState } from "@/components/primitives/empty-state";
import { ScrollArea } from "@/components/primitives/scroll-area";

export const DiffDrawerEmptyState = () => (
  <Stack h="full" minH="0" gap="0" bg="bg">
    <ScrollArea flex="1" minH="0" contentProps={{ p: "xs", spaceY: "xs" }}>
      <EmptyState title="No changes detected" description="Make some changes to see the diff here." paddingY="sm" />
    </ScrollArea>
  </Stack>
);
