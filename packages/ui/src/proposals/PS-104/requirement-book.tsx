import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ResizableSplitLayout } from "../../components/layout/resizable-split-layout";
import { DeleteConfirmationModal } from "../../components/overlays/delete-confirmation-modal";
import { AlertMessage } from "../../components/primitives/alert";
import { ScrollArea } from "../../components/primitives/scroll-area";
import { BookBrowser } from "./book-browser";
import { BookCreateDialog } from "./book-create-dialog";
import { BookReview } from "./book-findings";
import { chapters, findRule, initialRules } from "./book-model";
import { BookNavigation } from "./book-navigation";
import { BookObservation } from "./book-observation";
import { RuleIdTag } from "./book-resource-tag";
import { BookRevision } from "./book-revision";
import { BookSearch } from "./book-search";
import { BookSuggestion } from "./book-suggestion";
import { promoteObservation, removalOperations } from "./book-workflow";
import { useBookPrototype } from "./use-book-prototype";

export function RequirementBook() {
  const {
    workflow,
    setWorkflow,
    revision,
    setRevision,
    section,
    setSection,
    chapter,
    setChapter,
    selected,
    setSelected,
    editor,
    setEditor,
    creating,
    setCreating,
    removing,
    setRemoving,
    searchOpen,
    setSearchOpen,
    error,
    setError,
    rules,
    observations,
    records,
    unread,
    markRead,
    openChapter,
    openRule,
    stage,
    suggestionAction,
    map,
  } = useBookPrototype();
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
              setError("");
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
              flexWrap="wrap"
            >
              <HStack gap="sm">
                {!section && <RuleIdTag reference={`RB${chapter}`} />}
                <Text as="h1" textStyle="label/L/medium">
                  {section ?? chapters[chapter - 1].title}
                </Text>
              </HStack>
              <HStack gap="xs">
                {section && unread[section] > 0 && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      setWorkflow({
                        ...workflow,
                        readIds: [
                          ...new Set([
                            ...workflow.readIds,
                            ...records.filter((item) => item.section === section).map((item) => item.id),
                          ]),
                        ],
                      })
                    }
                  >
                    Mark all read
                  </Button>
                )}
                <BookRevision
                  revision={revision}
                  onRevision={(next) => {
                    setRevision(next);
                    setEditor(null);
                    const current = findRule(next === "accepted" ? initialRules : workflow.branch, selected);
                    if (current) setChapter(current.chapter);
                  }}
                />
              </HStack>
            </HStack>
            {error && (
              <AlertMessage status="error" title="Could not update the prototype" onClose={() => setError("")}>
                {error}
              </AlertMessage>
            )}
            {section ? (
              <ScrollArea flex="1" minH="0">
                <Stack p="lg" gap="md" maxW="6xl">
                  {section === "Findings" && (
                    <BookReview
                      section={section}
                      rules={rules}
                      readIds={workflow.readIds}
                      onRead={markRead}
                      onOpen={openRule}
                      onReview={() => setSection("Suggestions")}
                    />
                  )}
                  {section === "Undocumented" && (
                    <>
                      {observations.map((observation) => (
                        <BookObservation
                          key={observation.id}
                          observation={observation}
                          rules={workflow.branch}
                          unread={!workflow.readIds.includes(observation.id)}
                          onRead={markRead}
                          onMap={map}
                          onPromote={(id) => {
                            setWorkflow(promoteObservation(workflow, id));
                            setSection("Suggestions");
                          }}
                        />
                      ))}
                      {!observations.length && (
                        <Text color="fg.muted" textStyle="paragraph/S/regular">
                          No unmapped observations. Mapped evidence remains on its requirements; mapping does not
                          establish compliance.
                        </Text>
                      )}
                    </>
                  )}
                  {section === "Suggestions" && (
                    <>
                      {workflow.suggestions.map((suggestion) => (
                        <BookSuggestion
                          key={suggestion.id}
                          suggestion={suggestion}
                          branch={workflow.branch}
                          unread={!workflow.readIds.includes(suggestion.id)}
                          onRead={markRead}
                          onOpen={openRule}
                          onAction={suggestionAction}
                        />
                      ))}
                      {!workflow.suggestions.length && (
                        <Text color="fg.muted" textStyle="paragraph/S/regular">
                          No local suggestions.
                        </Text>
                      )}
                    </>
                  )}
                </Stack>
              </ScrollArea>
            ) : (
              <BookBrowser
                rules={rules}
                chapter={chapter}
                selected={selected}
                editor={editor}
                observations={workflow.observations}
                onMapObservation={map}
                onSelect={(ref) => {
                  setSelected(ref);
                  setEditor(null);
                }}
                onOpen={openRule}
                onCreate={() => setCreating(true)}
                onEdit={(rule) => {
                  const current = findRule(workflow.branch, rule.ref);
                  if (!current) {
                    setError(
                      "This rule was removed on the working branch. Prepare an ADD suggestion to introduce new intent.",
                    );
                    return;
                  }
                  setRevision("branch");
                  setChapter(current.chapter);
                  setEditor(current);
                }}
                onRemove={setRemoving}
                onCancel={() => setEditor(null)}
                onSave={(rule) =>
                  stage(`Amend ${rule.title}`, [
                    { type: "AMEND", before: findRule(workflow.branch, rule.ref) ?? null, after: rule },
                  ])
                }
              />
            )}
          </Stack>
        }
      />
      <BookCreateDialog
        open={creating}
        chapter={chapter}
        rules={workflow.branch}
        onClose={() => setCreating(false)}
        onCreate={(draft) =>
          stage(`Add ${draft.title}`, [
            { type: "ADD", before: null, after: { ...draft, ref: `RB ${draft.chapter}.A.${workflow.nextId}` } },
          ])
        }
      />
      <BookSearch rules={rules} open={searchOpen} onOpen={openRule} onClose={() => setSearchOpen(false)} />
      <DeleteConfirmationModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        headline={`Propose removing ${removing?.ref ?? "rule"}?`}
        notificationText="Review the removal and incoming-link changes in Suggestions before applying to the working branch."
        buttonText="Create removal suggestion"
        onDelete={() => {
          if (!removing) return;
          stage(
            `Remove ${removing.title}`,
            removalOperations(workflow.branch, findRule(workflow.branch, removing.ref) ?? removing),
          );
        }}
      />
    </>
  );
}
