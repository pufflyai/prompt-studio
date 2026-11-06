import { Button, Field, HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { findRule, type Rule } from "./book-model";
import { acceptanceConditions } from "./forms";

interface EditorProps {
  rule: Rule;
  rules: Rule[];
  onSave: (rule: Rule, reason: string) => void;
  onCancel: () => void;
}
export function RuleEditor(props: EditorProps) {
  const { rule, rules, onSave, onCancel } = props;
  const [reason, setReason] = useState("");
  const [title, setTitle] = useState(rule.title);
  const [statement, setStatement] = useState(rule.statement);
  const [acceptance, setAcceptance] = useState(rule.acceptance.map((item) => item.statement).join("\n"));
  const [related, setRelated] = useState(rule.related.join(", "));
  const references = related
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean);
  const unknown = references.filter((ref) => ref === rule.ref || !findRule(rules, ref));
  const valid = reason.trim() && title.trim() && statement.trim() && unknown.length === 0;
  return (
    <Stack
      as="form"
      h="full"
      minH="0"
      w="full"
      gap="md"
      p="lg"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid)
          onSave(
            {
              ...rule,
              title: title.trim(),
              statement: statement.trim(),
              acceptance: acceptanceConditions(acceptance),
              related: references,
            },
            reason.trim(),
          );
      }}
    >
      <HStack justify="space-between" flexShrink="0" flexWrap="wrap">
        <Text as="h2" textStyle="label/L/medium">
          Edit rule
        </Text>
        <HStack gap="xs">
          <Button size="xs" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="xs" variant="solid" type="submit" disabled={!valid}>
            Save suggestion
          </Button>
        </HStack>
      </HStack>
      <ScrollArea flex="1" minH="0">
        <Stack gap="md">
          <Field.Root required>
            <Field.Label>Title</Field.Label>
            <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field.Root>
          <Field.Root required>
            <Field.Label>Requirement</Field.Label>
            <Textarea value={statement} onChange={(event) => setStatement(event.target.value)} />
          </Field.Root>
          <Field.Root required>
            <Field.Label>Reason for this change</Field.Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field.Root>
          <Field.Root>
            <Field.Label>Acceptance</Field.Label>
            <Textarea value={acceptance} onChange={(event) => setAcceptance(event.target.value)} />
          </Field.Root>
          <Field.Root invalid={unknown.length > 0}>
            <Field.Label>Related requirements</Field.Label>
            <Input
              value={related}
              placeholder="RB 1.A.1, RBE 16.A.1"
              onChange={(event) => setRelated(event.target.value)}
            />
            {unknown.length > 0 && (
              <Field.ErrorText>Choose an existing, different requirement: {unknown.join(", ")}</Field.ErrorText>
            )}
          </Field.Root>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
