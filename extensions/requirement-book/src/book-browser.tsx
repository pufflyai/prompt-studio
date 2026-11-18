import { IconButton as ActionIconButton, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ResizableSplitLayout, ScrollArea, SearchableMenu, TreeList } from "@pstdio/ui";
import { MarkdownPreview } from "@pstdio/ui/rich-text";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { useRef } from "react";
import { BookAcceptance } from "./book-acceptance";
import { RuleEditor } from "./book-editor";
import { type Chapter, findRule, type Rule } from "./book-model";
import { RuleIdTag, RuleTag } from "./book-resource-tag";

interface BrowserProps {
  rules: Rule[];
  chapters: Chapter[];
  onMove: (rule: Rule, chapter: number) => void;
  chapter: number;
  selected: string;
  editor: Rule | null;
  onSelect: (ref: string) => void;
  onOpen: (ref: string) => void;
  onEdit: (rule: Rule) => void;
  onRemove: (rule: Rule) => void;
  onSave: (rule: Rule, reason: string) => void;
  onCancel: () => void;
}
interface PreviewProps {
  chapters: Chapter[];
  onMove: (rule: Rule, chapter: number) => void;
  rule: Rule;
  rules: Rule[];
  onOpen: (ref: string) => void;
  onEdit: (rule: Rule) => void;
  onRemove: (rule: Rule) => void;
}
function RulePreview(props: PreviewProps) {
  const { rule, rules, chapters, onMove, onOpen, onEdit, onRemove } = props;
  return (
    <Stack h="full" minH="0" minW="0" w="full" gap="0">
      <HStack px="md" py="2xs" gap="sm" minW="0" flexShrink="0" borderBottomWidth="1px" borderColor="border.subtle">
        <RuleIdTag reference={rule.ref} />
        <Text as="h2" textStyle="label/M/medium" minW="0" flex="1" truncate title={rule.title}>
          {rule.title}
        </Text>
        <HStack gap="2xs" flexShrink="0">
          <SearchableMenu
            lazyMount
            trigger={
              <Button size="xs" variant="ghost">
                Move
              </Button>
            }
            items={chapters
              .filter(
                (item) =>
                  item.id !== rule.chapter && item.group === chapters.find((entry) => entry.id === rule.chapter)?.group,
              )
              .map((item) => ({ id: String(item.id), label: item.title, onSelect: () => onMove(rule, item.id) }))}
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
        <Stack p="md" gap="md">
          <MarkdownPreview defaultState={rule.statement} isEditable={false} fullWidth />
          {rule.rationale && <Text>{rule.rationale}</Text>}
          {rule.governing.length > 0 && (
            <HStack flexWrap="wrap" gap="xs">
              {rule.governing.map((ref) => (
                <RuleTag key={ref} reference={ref} onOpen={onOpen} />
              ))}
            </HStack>
          )}
          <BookAcceptance conditions={rule.acceptance} />
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
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
export function BookBrowser(props: BrowserProps) {
  const { rules, chapters, onMove, chapter, selected, editor, onSelect, onOpen, onEdit, onRemove, onSave, onCancel } =
    props;
  const treeScroll = useRef<HTMLDivElement>(null);
  const results = rules.filter((rule) => rule.chapter === chapter);
  const rule = findRule(rules, selected);
  return (
    <ResizableSplitLayout
      flex="1"
      minH="0"
      defaultSizePx={300}
      contentMinSizePx={320}
      collapsible={false}
      separator="line"
      resizablePanel={
        <ScrollArea
          flex="1"
          h="full"
          minH="0"
          minW="0"
          viewportRef={treeScroll}
          contentProps={{ minW: "0", w: "full" }}
        >
          <TreeList
            virtualize
            scrollRef={treeScroll}
            rowVariant="compact"
            nodeGap="0"
            sections={[...new Set(results.map((rule) => rule.section))].map((section) => ({
              id: section,
              label: section || undefined,
              collapsible: false,
              nodes: results
                .filter((item) => item.section === section)
                .map((item) => ({
                  id: item.ref,
                  label: item.title,
                  tooltip: `${item.ref} ${item.title}`,
                  icon: <FileText />,
                  rowVariant: "file" as const,
                  isNavigable: true,
                })),
            }))}
            activeNodeId={selected}
            onNavigate={(event) => onSelect(event.nodeId)}
          />
          {!results.length && (
            <Text p="sm" color="fg.muted">
              No rules yet.
            </Text>
          )}
        </ScrollArea>
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
              onOpen={onOpen}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          )}
          {!editor && !rule && (
            <Text p="md" color="fg.muted">
              Select a rule.
            </Text>
          )}
        </>
      }
    />
  );
}
