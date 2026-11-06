import { IconButton as ActionIconButton, Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ResizableSplitLayout, ScrollArea, SearchableMenu, TreeList } from "@pstdio/ui";
import { MarkdownPreview } from "@pstdio/ui/rich-text";
import { Pencil, Trash2 } from "lucide-react";
import { RuleEditor } from "./book-editor";
import { type Chapter, findRule, type Rule } from "./book-model";
import { RuleIdTag, RuleTag, TestTag } from "./book-resource-tag";
import type { Observation } from "./records";

interface BrowserProps {
  rules: Rule[];
  chapters: Chapter[];
  onMove: (rule: Rule, chapter: number) => void;
  chapter: number;
  selected: string;
  editor: Rule | null;
  onSelect: (ref: string) => void;
  onOpen: (ref: string) => void;
  onCreate: () => void;
  onEdit: (rule: Rule) => void;
  onRemove: (rule: Rule) => void;
  onSave: (rule: Rule, reason: string) => void;
  onCancel: () => void;
  observations: Observation[];
  onMapObservation: (id: string, ref: string) => void;
}
interface PreviewProps {
  chapters: Chapter[];
  onMove: (rule: Rule, chapter: number) => void;
  rule: Rule;
  rules: Rule[];
  onOpen: (ref: string) => void;
  onEdit: (rule: Rule) => void;
  onRemove: (rule: Rule) => void;
  observations: Observation[];
  onMapObservation: (id: string, ref: string) => void;
}
function RulePreview({
  rule,
  rules,
  chapters,
  onMove,
  observations,
  onMapObservation,
  onOpen,
  onEdit,
  onRemove,
}: PreviewProps) {
  return (
    <Stack h="full" minH="0" w="full" gap="lg" p="lg">
      <HStack justify="space-between" align="start" gap="md" flexShrink="0">
        <Stack gap="xs">
          <HStack>
            <RuleIdTag reference={rule.ref} />
            <Badge variant="plain">L{rule.level}</Badge>
            <Badge variant="plain">{rule.status}</Badge>
          </HStack>
          <Text as="h2" textStyle="label/L/medium">
            {rule.title}
          </Text>
        </Stack>
        <HStack gap="2xs">
          <SearchableMenu
            trigger={
              <Button size="xs" variant="ghost">
                Move
              </Button>
            }
            items={chapters
              .filter((item) => item.id !== rule.chapter)
              .map((item) => ({
                id: String(item.id),
                label: `RB${item.id} ${item.title}`,
                onSelect: () => onMove(rule, item.id),
              }))}
            searchPlaceholder="Choose chapter…"
            emptyState="Add another chapter first"
          />
          <ActionIconButton aria-label="Edit rule" size="xs" variant="ghost" onClick={() => onEdit(rule)}>
            <Pencil />
          </ActionIconButton>
          <ActionIconButton
            aria-label="Remove rule"
            size="xs"
            variant="ghost"
            colorPalette="red"
            onClick={() => onRemove(rule)}
          >
            <Trash2 />
          </ActionIconButton>
        </HStack>
      </HStack>
      <ScrollArea flex="1" minH="0">
        <Stack gap="lg">
          <MarkdownPreview key={rule.statement} defaultState={rule.statement} isEditable={false} fullWidth />
          {rule.rationale && <Text>{rule.rationale}</Text>}
          {rule.governing.length > 0 && (
            <Stack gap="sm">
              <Text textStyle="label/M/medium">Governing intent</Text>
              <HStack flexWrap="wrap">
                {rule.governing.map((ref) => (
                  <RuleTag key={ref} reference={ref} onOpen={onOpen} />
                ))}
              </HStack>
            </Stack>
          )}
          <Stack gap="sm">
            <Text as="h3" textStyle="label/M/medium">
              Scope
            </Text>
            <Text textStyle="paragraph/S/regular">{rule.scope}</Text>
          </Stack>
          <Stack gap="sm">
            <Text as="h3" textStyle="label/M/medium">
              Acceptance
            </Text>
            {rule.acceptance.map((condition) => (
              <Stack key={condition.statement} gap="sm">
                <Text textStyle="paragraph/S/regular">{condition.statement}</Text>
                <HStack flexWrap="wrap" gap="xs">
                  {condition.tests.map((path) => (
                    <TestTag key={path} path={path} />
                  ))}
                </HStack>
              </Stack>
            ))}
          </Stack>
          {rule.related.length > 0 && (
            <Stack gap="sm">
              <Text as="h3" textStyle="label/M/medium">
                Related
              </Text>
              <HStack flexWrap="wrap" gap="xs">
                {rule.related.map((ref) => (
                  <RuleTag key={ref} reference={ref} title={findRule(rules, ref)?.title} onOpen={onOpen} />
                ))}
              </HStack>
            </Stack>
          )}
          {observations
            .filter((item) => item.requirements.includes(rule.ref))
            .map((item) => (
              <Stack key={item.id} gap="sm">
                <Text as="h3" textStyle="label/M/medium">
                  Evidence · {item.id}
                </Text>
                <Badge alignSelf="start" colorPalette="blue">
                  {item.kind}
                </Badge>
                <Text textStyle="paragraph/S/regular">{item.claim}</Text>
                <Text textStyle="paragraph/XS/regular" color="fg.muted">
                  {item.revision} · {item.conditions}
                </Text>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  {item.limits}
                </Text>
                <HStack gap="xs" flexWrap="wrap">
                  {item.requirements
                    .filter((ref) => ref !== rule.ref)
                    .map((ref) => (
                      <RuleTag key={ref} reference={ref} onOpen={onOpen} />
                    ))}
                  <SearchableMenu
                    trigger={
                      <Button size="xs" variant="outline">
                        Map to another requirement
                      </Button>
                    }
                    items={rules
                      .filter((target) => !item.requirements.includes(target.ref))
                      .map((target) => ({
                        id: target.ref,
                        label: `${target.ref} ${target.title}`,
                        searchText: target.statement,
                        onSelect: () => onMapObservation(item.id, target.ref),
                      }))}
                    searchPlaceholder="Find another requirement…"
                    emptyState="All requirements are already mapped"
                  />
                </HStack>
                <Button size="xs" variant="ghost" alignSelf="start" onClick={() => onMapObservation(item.id, rule.ref)}>
                  Remove mapping
                </Button>
              </Stack>
            ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
export function BookBrowser(props: BrowserProps) {
  const {
    rules,
    chapters,
    onMove,
    chapter,
    selected,
    editor,
    observations,
    onMapObservation,
    onSelect,
    onOpen,
    onCreate,
    onEdit,
    onRemove,
    onSave,
    onCancel,
  } = props;
  const results = rules.filter((rule) => rule.chapter === chapter);
  const rule = findRule(rules, selected);
  return (
    <ResizableSplitLayout
      flex="1"
      minH="0"
      defaultSizePx={360}
      contentMinSizePx={320}
      collapsible={false}
      separator="line"
      resizablePanel={
        <Stack h="full" minH="0" gap="xs" py="xs" px="0">
          <HStack justify="space-between" px="sm">
            <Text textStyle="label/S/medium">Rules</Text>
            <Button size="xs" variant="ghost" onClick={onCreate}>
              New rule
            </Button>
          </HStack>
          <ScrollArea flex="1" minH="0">
            <TreeList
              sections={[...new Set(["Behavior", "Contracts", ...results.map((rule) => rule.section)])]
                .map((section) => ({
                  id: section,
                  label: section,
                  collapsible: false,
                  nodes: results
                    .filter((item) => item.section === section)
                    .map((item) => ({
                      id: item.ref,
                      label: item.title,
                      startContent: <RuleIdTag reference={item.ref} />,
                      rowVariant: "file" as const,
                      isNavigable: true,
                    })),
                }))
                .filter((section) => section.nodes.length > 0)}
              activeNodeId={selected}
              rowVariant="compact"
              onNavigate={(event) => onSelect(event.nodeId)}
            />
            {results.length === 0 && (
              <Text p="sm" color="fg.muted">
                No rules yet.
              </Text>
            )}
          </ScrollArea>
        </Stack>
      }
      contentPanel={
        <>
          {editor && <RuleEditor key={editor.ref} rule={editor} rules={rules} onSave={onSave} onCancel={onCancel} />}
          {!editor && rule && (
            <RulePreview
              rule={rule}
              rules={rules}
              chapters={chapters}
              onMove={onMove}
              observations={observations}
              onMapObservation={onMapObservation}
              onOpen={onOpen}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          )}
          {!editor && !rule && (
            <Text p="lg" color="fg.muted">
              Select a rule.
            </Text>
          )}
        </>
      }
    />
  );
}
