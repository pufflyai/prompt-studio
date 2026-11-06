import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { ResizableSplitLayout } from "../../components/layout/resizable-split-layout";
import { DeleteConfirmationModal } from "../../components/overlays/delete-confirmation-modal";
import { ScrollArea } from "../../components/primitives/scroll-area";
import { BookBrowser } from "./book-browser";
import { BookCreateDialog } from "./book-create-dialog";
import { BookReview } from "./book-findings";
import { chapters, findRule, initialRules, type Rule, removeRule, type Section, saveRule } from "./book-model";
import { BookNavigation } from "./book-navigation";
import { RuleIdTag } from "./book-resource-tag";
import { reviewItems, unreadCounts } from "./book-review-model";
import { BookSearch } from "./book-search";

export function RequirementBook() {
  const [rules, setRules] = useState(initialRules);
  const [section, setSection] = useState<Section | null>(null);
  const [chapter, setChapter] = useState(1);
  const [selected, setSelected] = useState("RB 1.A.1");
  const [editor, setEditor] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Rule | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const nextOrdinal = useRef(100);
  const [readIds, setReadIds] = useState<string[]>([]);
  const unread = unreadCounts(readIds);
  const markRead = (id: string) => setReadIds((current) => (current.includes(id) ? current : [...current, id]));
  useEffect(() => {
    const handleSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleSearch);
    return () => window.removeEventListener("keydown", handleSearch);
  }, []);
  const openChapter = (id: number) => {
    setSection(null);
    setChapter(id);
    setEditor(null);
    setSelected(rules.find((rule) => rule.chapter === id)?.ref ?? "");
  };
  const openRule = (ref: string) => {
    const rule = findRule(rules, ref);
    if (!rule) return;
    setSection(null);
    setChapter(rule.chapter);
    setSelected(ref);
    setEditor(null);
  };

  return (
    <>
      <ResizableSplitLayout
        h="full"
        minH="0"
        bg="bg"
        color="fg"
        separator="line"
        collapsible={false}
        resizablePanel={
          <BookNavigation
            activeSection={section}
            chapter={chapter}
            unread={unread}
            onSearch={() => setSearchOpen(true)}
            onSection={(next) => {
              setSection(next);
              setEditor(null);
            }}
            onChapter={openChapter}
          />
        }
        contentPanel={
          <Stack w="full" h="full" minH="0" gap="0">
            <HStack
              px="lg"
              py="md"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              justify="space-between"
              flexShrink="0"
            >
              <HStack gap="sm">
                {!section && <RuleIdTag reference={`RB${chapter}`} />}
                <Text as="h1" textStyle="label/L/medium">
                  {section ?? chapters[chapter - 1].title}
                </Text>
              </HStack>
              {section && unread[section] > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    const ids = reviewItems.filter((item) => item.section === section).map((item) => item.id);
                    setReadIds([...new Set([...readIds, ...ids])]);
                  }}
                >
                  Mark all read
                </Button>
              )}
            </HStack>
            {section ? (
              <ScrollArea flex="1" minH="0">
                <Stack p="lg">
                  <BookReview section={section} rules={rules} readIds={readIds} onRead={markRead} onOpen={openRule} />
                </Stack>
              </ScrollArea>
            ) : (
              <BookBrowser
                rules={rules}
                chapter={chapter}
                selected={selected}
                editor={editor}
                onSelect={(ref) => {
                  setSelected(ref);
                  setEditor(null);
                }}
                onOpen={openRule}
                onCreate={() => setCreating(true)}
                onEdit={setEditor}
                onRemove={setRemoving}
                onCancel={() => setEditor(null)}
                onSave={(rule) => {
                  setRules(saveRule(rules, rule));
                  setSelected(rule.ref);
                  setEditor(null);
                }}
              />
            )}
          </Stack>
        }
      />
      <BookCreateDialog
        open={creating}
        chapter={chapter}
        rules={rules}
        onClose={() => setCreating(false)}
        onCreate={(draft) => {
          const rule = { ...draft, ref: `RB ${draft.chapter}.A.${nextOrdinal.current++}` };
          setRules(saveRule(rules, rule));
          setSelected(rule.ref);
          setEditor(null);
        }}
      />
      <BookSearch rules={rules} open={searchOpen} onOpen={openRule} onClose={() => setSearchOpen(false)} />
      <DeleteConfirmationModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        headline={`Remove ${removing?.ref ?? "rule"}?`}
        notificationText={removing?.title}
        buttonText="Remove rule"
        onDelete={() => {
          if (!removing) return;
          const remaining = removeRule(rules, removing.ref);
          setRules(remaining);
          setEditor(null);
          if (selected === removing.ref) setSelected(remaining.find((rule) => rule.chapter === chapter)?.ref ?? "");
        }}
      />
    </>
  );
}
