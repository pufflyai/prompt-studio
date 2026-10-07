// Step through the tickets of one milestone that need a person, from the side panel.
import { Flex, Icon, IconButton, Text } from "@chakra-ui/react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export interface Review {
  position: number;
  total: number;
  onStep: (direction: 1 | -1) => void;
}

export function ReviewBar({ review }: { review: Review }) {
  return (
    <Flex align="center" gap="xs" px="sm" py="2xs" bg="orange.subtle" borderRadius="md">
      <Text textStyle="label/S/medium" color="orange.fg" flex="1">
        Needs human review · {review.position} of {review.total}
      </Text>
      <IconButton size="2xs" variant="ghost" aria-label="Previous ticket to review" onClick={() => review.onStep(-1)}>
        <Icon as={ArrowLeft} />
      </IconButton>
      <IconButton size="2xs" variant="ghost" aria-label="Next ticket to review" onClick={() => review.onStep(1)}>
        <Icon as={ArrowRight} />
      </IconButton>
    </Flex>
  );
}
