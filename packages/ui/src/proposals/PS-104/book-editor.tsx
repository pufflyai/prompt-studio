import { Button, Field, HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";
import { ScrollArea } from "../../components/primitives/scroll-area";
import { findRule, type Rule } from "./book-model";

interface EditorProps {
  rule: Rule;
  rules: Rule[];
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}
export function RuleEditor(props: EditorProps) {
  const { rule, rules, onSave, onCancel } = props;
  const [title, setTitle] = useState(rule.title);
  const [statement, setStatement] = useState(rule.statement);
  const [acceptance, setAcceptance] = useState(rule.acceptance[0]?.statement ?? "");
  const [tests, setTests] = useState(rule.acceptance[0]?.tests.join("\n") ?? "");
  const [related, setRelated] = useState(rule.related.join(", "));
  const references = related
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean);
  const unknown = references.filter((ref) => ref === rule.ref || !findRule(rules, ref));
  const testPaths = tests
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean);
  const valid = title.trim() && statement.trim() && acceptance.trim() && testPaths.length > 0 && unknown.length === 0;
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
          onSave({
            ...rule,
            title: title.trim(),
            statement: statement.trim(),
            acceptance: [{ statement: acceptance.trim(), tests: testPaths }],
            related: references,
          });
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
          <Button size="xs" variant="primary" type="submit" disabled={!valid}>
            Save
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
            <Field.Label>Acceptance</Field.Label>
            <Textarea value={acceptance} onChange={(event) => setAcceptance(event.target.value)} />
          </Field.Root>
          <Field.Root required>
            <Field.Label>Tests</Field.Label>
            <Textarea
              value={tests}
              placeholder="path/to/feature.p1.test.ts"
              onChange={(event) => setTests(event.target.value)}
            />
          </Field.Root>
          <Field.Root invalid={unknown.length > 0}>
            <Field.Label>Related requirements</Field.Label>
            <Input
              value={related}
              placeholder="RB 1.A.1, RB 2.A.1"
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
