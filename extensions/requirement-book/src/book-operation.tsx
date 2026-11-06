import { Badge, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { MarkdownPreview } from "@pstdio/ui/rich-text";
import { BookAcceptance } from "./book-acceptance";
import type { Rule } from "./book-model";
import { RuleTag } from "./book-resource-tag";
import { type Operation, sameRule } from "./model";

interface VersionProps {
  label: string;
  rule: Rule | null;
  onOpen: (ref: string) => void;
}
function RuleVersion(props: VersionProps) {
  const { label, rule, onOpen } = props;
  return (
    <Stack gap="sm" p="md" borderWidth="1px" borderColor="border.subtle" minW="0">
      <Text textStyle="label/S/medium" color="fg.muted">
        {label}
      </Text>
      {rule ? (
        <>
          <Text textStyle="label/M/medium">{rule.title}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {rule.ref}
          </Text>
          <MarkdownPreview defaultState={rule.statement} isEditable={false} fullWidth />
          {rule.rationale && <Text>{rule.rationale}</Text>}
          <BookAcceptance conditions={rule.acceptance} />
          <HStack flexWrap="wrap" gap="xs">
            {[...rule.governing, ...rule.related].map((ref) => (
              <RuleTag key={ref} reference={ref} onOpen={onOpen} />
            ))}
          </HStack>
        </>
      ) : (
        <Text color="fg.muted" textStyle="paragraph/S/regular">
          No requirement in this version.
        </Text>
      )}
    </Stack>
  );
}

interface OperationProps {
  operation: Operation;
  current?: Rule;
  onOpen: (ref: string) => void;
}
export function BookOperation(props: OperationProps) {
  const { operation, current, onOpen } = props;
  const stale = operation.before && !sameRule(operation.before, current);
  return (
    <Stack gap="sm">
      <HStack gap="sm">
        <Badge>{operation.type}</Badge>
        <Text textStyle="label/S/medium">{operation.after?.ref ?? operation.before?.ref}</Text>
      </HStack>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="sm">
        <RuleVersion label="Draft baseline" rule={operation.before} onOpen={onOpen} />
        <RuleVersion label="Proposed" rule={operation.after} onOpen={onOpen} />
      </SimpleGrid>
      {stale && (
        <RuleVersion label="Current working branch · comparison changed" rule={current ?? null} onOpen={onOpen} />
      )}
    </Stack>
  );
}
