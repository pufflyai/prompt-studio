import { Box, Flex } from "@chakra-ui/react";

interface SliderMarksProps {
  count?: number;
}

// Evenly-spaced tick marks rendered under a slider track. Purely decorative.
export const SliderMarks = (props: SliderMarksProps) => {
  const { count } = props;
  if (!count || count < 2) return null;
  const positions = Array.from({ length: count }, (_, index) => index / (count - 1));

  return (
    <Flex justifyContent="space-between" mt="2xs" aria-hidden="true">
      {positions.map((position) => (
        <Box key={position} width="1px" height="0.375rem" bg="border.subtle" />
      ))}
    </Flex>
  );
};
