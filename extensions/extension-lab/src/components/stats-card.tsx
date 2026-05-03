import { HStack, Stack, Text } from "@chakra-ui/react";
import { useLabStore } from "../store/lab-store";

export const StatsCard = () => {
  const counter = useLabStore((state) => state.counter);
  const noteCount = useLabStore((state) => state.notes.length);

  return (
    <HStack bg="bg" borderWidth="1px" borderColor="border" borderRadius="md" boxShadow="sm" overflow="hidden">
      <Stack flex="1" gap="2xs" padding="md">
        <Text textStyle="label/XS/medium" color="fg.muted">
          Counter
        </Text>
        <Text textStyle="heading/M/bold" fontVariantNumeric="tabular-nums">
          {counter}
        </Text>
      </Stack>
      <Stack flex="1" gap="2xs" padding="md" borderLeftWidth="1px" borderLeftColor="border">
        <Text textStyle="label/XS/medium" color="fg.muted">
          Notes
        </Text>
        <Text textStyle="heading/M/bold" fontVariantNumeric="tabular-nums">
          {noteCount}
        </Text>
      </Stack>
    </HStack>
  );
};
