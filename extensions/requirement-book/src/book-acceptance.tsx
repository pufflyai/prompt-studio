import { List, Stack, Text } from "@chakra-ui/react";
import type { Rule } from "./model";

export function BookAcceptance(props: { conditions: Rule["acceptance"] }) {
  const { conditions } = props;
  if (!conditions.length) return null;
  return (
    <Stack gap="sm">
      <Text as="h3" textStyle="label/M/medium">
        Acceptance
      </Text>
      <List.Root gap="xs" ps="md" listStyleType="disc" textStyle="paragraph/S/regular">
        {conditions.map((condition) => (
          <List.Item key={condition.statement}>{condition.statement}</List.Item>
        ))}
      </List.Root>
    </Stack>
  );
}
