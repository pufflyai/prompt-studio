import { Button, Flex, Input, Text } from "@chakra-ui/react";

export const LetterToolbarControls = (props: {
  search: string;
  onSearchChange(value: string): void;
  resource: string;
  result: string;
  onReadContext(): void;
}) => (
  <Flex align="center" justify="end" h="full" minW="0" gap="xs" color="fg">
    <Input
      flex="1"
      aria-label="Letter search"
      placeholder="Search letters…"
      size="xs"
      minW="0"
      w="full"
      maxW="xs"
      value={props.search}
      onChange={(event) => props.onSearchChange(event.target.value)}
    />
    <Button aria-label="Read header context" size="xs" variant="outline" flexShrink="0" onClick={props.onReadContext}>
      {props.result ? `Context: ${props.result}` : "Check context"}
    </Button>
    <Text
      aria-label={`Header for ${props.resource}`}
      textStyle="label/XS"
      color="fg.muted"
      whiteSpace="nowrap"
      flexShrink="0"
    >
      {props.resource === "landing" ? "New letter" : `Letter ${props.resource}`}
    </Text>
    <Text as="output" role="status" aria-label="Header context" aria-live="polite" srOnly>
      {props.result ? `Command for ${props.result}` : ""}
    </Text>
  </Flex>
);
