import { SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ScrollArea } from "../primitives/scroll-area";

export function VisualizationFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack h="3xl" w="full" gap="0" bg="bg" color="fg">
      <Text p="md" textStyle="heading/S/medium">
        {title}
      </Text>
      <ScrollArea flex="1" minH="0">
        <SimpleGrid columns={2} p="md" gap="md" minW="4xl">
          {children}
        </SimpleGrid>
      </ScrollArea>
    </Stack>
  );
}
