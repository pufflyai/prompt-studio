import { Badge, Box, Button, HStack, Separator, Stack, Text, useRecipe } from "@chakra-ui/react";
import type { LexicalEditor } from "lexical";
import { FileText, History, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { SearchableMenu } from "@/components/overlays/searchable-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Switch } from "@/components/primitives/switch";
import { MarkdownEditor as ResourceEditor } from "@/components/rich-text/markdown-editor/markdown-editor";
import { ChangePreview, HandoffDialog, SessionPreview } from "./handoff-dialog";
import { MarkdownEditor } from "./markdown-editor";
import { PlannerPreview } from "./planner-preview";
import { ResourceActivity } from "./resource-activity";
import { reviewDocumentRecipe } from "./review-document-recipe";
import { ReviewPlugin, selectComment } from "./review-plugin";
import { useResourceActivity } from "./use-resource-activity";

function ResourceReview() {
  const controller = useResourceActivity();
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const editorRef = useRef<LexicalEditor | null>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const styles = useRecipe({ recipe: reviewDocumentRecipe })();
  const { resource, activity } = controller;
  if (collectionOpen)
    return <PlannerPreview openCount={controller.openCount} onOpen={() => setCollectionOpen(false)} />;

  return (
    <Stack h="full" minH="0" gap="0" bg="bg" color="fg">
      <HStack
        px="md"
        py="sm"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        justify="space-between"
        flexWrap="wrap"
      >
        <HStack minW="0" gap="xs">
          {resource.id === "PS-118" && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                controller.recordBodyChange();
                setCollectionOpen(true);
              }}
            >
              Planner
            </Button>
          )}
          <SearchableMenu
            trigger={
              <Button variant="ghost" size="xs">
                <FileText />
                {resource.label}
              </Button>
            }
            searchPlaceholder="Find a resource"
            emptyState={<Text p="sm">No resources</Text>}
            items={controller.resources.map((item) => ({
              id: item.id,
              label: item.label,
              isSelected: item.id === resource.id,
              onSelect: () => controller.selectResource(item.id),
            }))}
          />
        </HStack>
        <HStack gap="xs">
          {resource.status && (
            <SearchableMenu
              trigger={
                <Button variant="ghost" size="xs">
                  {resource.status}
                </Button>
              }
              searchPlaceholder="Change status"
              emptyState={<Text p="sm">No statuses</Text>}
              items={["Backlog", "In progress", "Done"].map((status) => ({
                id: status,
                label: status,
                isSelected: resource.status === status,
                onSelect: () => controller.setStatus(status),
              }))}
            />
          )}
          {activity && (
            <Button variant="ghost" size="xs" onClick={() => activityRef.current?.scrollIntoView({ block: "start" })}>
              <History />
              Activity
            </Button>
          )}
        </HStack>
      </HStack>
      <ScrollArea flex="1" minH="0" contentProps={{ width: "full" }}>
        <Stack maxW="chat-content" mx="auto" px="md" py="lg" gap="xl">
          <Box
            css={styles}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) controller.recordBodyChange();
            }}
          >
            {activity?.comments ? (
              <MarkdownEditor
                key={resource.id}
                defaultState={resource.markdown}
                isEditable
                scrollable={false}
                padding="0"
                onChange={controller.editBody}
                onComment={() => {
                  if (editorRef.current) selectComment(editorRef.current, controller.selectQuote);
                }}
                reviewPlugin={
                  <ReviewPlugin
                    threads={controller.threads}
                    onTextChange={controller.setDocumentText}
                    showResolved={false}
                    onSelect={controller.selectQuote}
                    onOpen={controller.openThread}
                    onReady={(editor) => {
                      editorRef.current = editor;
                    }}
                  />
                }
              />
            ) : (
              <ResourceEditor
                key={resource.id}
                defaultState={resource.markdown}
                isEditable
                scrollable={false}
                padding="0"
                onChange={controller.editBody}
              />
            )}
          </Box>
          {activity && (
            <Box ref={activityRef}>
              <Separator mb="lg" />
              <ResourceActivity key={resource.id} controller={controller} />
            </Box>
          )}
        </Stack>
      </ScrollArea>
      {showMarkdown && (
        <ScrollArea maxH="48" borderTopWidth="1px" borderColor="border.subtle">
          <Box as="pre" p="sm" whiteSpace="pre-wrap" textStyle="paragraph/S/regular">
            {resource.markdown}
          </Box>
        </ScrollArea>
      )}
      <HStack px="sm" py="xs" gap="md" flexWrap="wrap" borderTopWidth="1px" borderColor="border.subtle">
        <Badge variant="chip">Prototype controls</Badge>
        <Switch checked={controller.failHandoff} onCheckedChange={({ checked }) => controller.setFailHandoff(checked)}>
          Fail handoffs
        </Switch>
        <Switch checked={showMarkdown} onCheckedChange={({ checked }) => setShowMarkdown(checked)}>
          Show Markdown
        </Switch>
      </HStack>
      <HandoffDialog controller={controller} />
      <SessionPreview controller={controller} />
      <ChangePreview controller={controller} />
    </Stack>
  );
}

export function TicketReviewPrototype() {
  const [version, setVersion] = useState(0);
  return (
    <Stack w="full" h="100vh" minH="0" gap="0">
      <HStack justify="end" px="sm" py="xs" bg="bg" borderBottomWidth="1px" borderColor="border.subtle">
        <Button variant="ghost" size="xs" onClick={() => setVersion(version + 1)}>
          <RotateCcw />
          Reset prototype
        </Button>
      </HStack>
      <Box flex="1" minH="0">
        <ResourceReview key={version} />
      </Box>
    </Stack>
  );
}
