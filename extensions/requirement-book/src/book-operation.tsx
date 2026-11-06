import { Badge, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { MarkdownPreview } from "@pstdio/ui/rich-text";
import type { Rule } from "./book-model";
import { RuleTag, TestTag } from "./book-resource-tag";
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
            L{rule.level} · RB{rule.chapter}
          </Text>
          <MarkdownPreview key={rule.statement} defaultState={rule.statement} isEditable={false} fullWidth />
          <Text textStyle="paragraph/XS/regular">
            {rule.status} · {rule.section}
          </Text>
          {rule.rationale && <Text>{rule.rationale}</Text>}
          <Text textStyle="label/S/medium">Scope</Text>
          <Text textStyle="paragraph/S/regular">{rule.scope}</Text>
          <Text textStyle="label/S/medium">Acceptance</Text>
          {rule.acceptance.map((condition) => (
            <Stack key={condition.statement} gap="xs">
              <Text textStyle="paragraph/S/regular">{condition.statement}</Text>
              <HStack flexWrap="wrap" gap="xs">
                {condition.tests.map((path) => (
                  <TestTag key={path} path={path} />
                ))}
              </HStack>
              {!condition.tests.length && (
                <Text color="fg.muted" textStyle="paragraph/XS/regular">
                  No test linked.
                </Text>
              )}
            </Stack>
          ))}
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
