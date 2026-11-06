import { Button, Field, HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";
import { SearchableMenu } from "../../components/overlays/searchable-menu";
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
  const [scope, setScope] = useState(rule.scope);
  const [level, setLevel] = useState(rule.level);
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
  const valid = title.trim() && statement.trim() && scope.trim() && acceptance.trim() && unknown.length === 0;
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
            scope: scope.trim(),
            level,
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
            <Field.Label>Scope</Field.Label>
            <Input value={scope} onChange={(event) => setScope(event.target.value)} />
          </Field.Root>
          <Field.Root>
            <Field.Label>Level</Field.Label>
            <SearchableMenu
              trigger={
                <Button size="xs" variant="outline">
                  L{level}
                </Button>
              }
              items={[0, 1, 2, 3].map((value) => ({
                id: String(value),
                label: `L${value}`,
                isSelected: level === value,
                onSelect: () => setLevel(value),
              }))}
              showSearch={false}
              searchPlaceholder="Choose level"
              emptyState="No levels"
            />
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
