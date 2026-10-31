import { Box, Button, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

export default { title: "Design System/Documentation" };

export const LongDocumentation = () => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Stack p="md" gap="lg" data-documentation-panel>
      <Text textStyle="heading/M">Intrinsic documentation height</Text>
      <Text textStyle="paragraph/M/regular">
        Documentation grows with its examples, API reference, and expanded sections. Pan or fit the canvas to read the
        whole panel.
      </Text>
      <Input aria-label="Documentation draft" defaultValue="Keep this draft while navigating" />
      <Button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        {expanded ? "Collapse API reference" : "Expand API reference"}
      </Button>
      {Array.from({ length: expanded ? 48 : 24 }, (_, index) => (
        <Stack key={index} gap="xs">
          <Text textStyle="heading/S">Example {index + 1}</Text>
          <Text textStyle="paragraph/M/regular">
            Use the shared component with local sample data and callbacks. Its state stays mounted while the canvas
            camera moves. The documentation frame has no fixed height or vertical scroll area.
          </Text>
          <Box as="pre" p="sm" bg="bg.subtle" textStyle="mono/S" whiteSpace="pre-wrap" overflowWrap="anywhere">
            {'<Button variant="primary" onClick={onSelect}>Choose example</Button>'}
          </Box>
        </Stack>
      ))}
      <Text data-documentation-end textStyle="label/M/medium">
        End of the full documentation
      </Text>
    </Stack>
  );
};
