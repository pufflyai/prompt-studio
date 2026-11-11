import { Badge, Box, Button, Flex, HStack, Stack, Text, useRecipe } from "@chakra-ui/react";
import type { LexicalEditor } from "lexical";
import { MessageSquare, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Switch } from "@/components/primitives/switch";
import { CommentPanel } from "./comment-panel";
import { HandoffDialog, SessionPreview } from "./handoff-dialog";
import { MarkdownEditor } from "./markdown-editor";
import { PlannerPreview } from "./planner-preview";
import { reviewDocumentRecipe } from "./review-document-recipe";
import { ReviewPlugin, selectComment } from "./review-plugin";
import { useReviewPrototype } from "./use-review-prototype";

function TicketReview() {
  const review = useReviewPrototype();
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const editorRef = useRef<LexicalEditor | null>(null);
  const styles = useRecipe({ recipe: reviewDocumentRecipe })();
  const onSelect = (quote: string) => {
    review.selectQuote(quote);
    setPanelOpen(true);
  };

  if (collectionOpen) return <PlannerPreview openCount={review.openCount} onOpen={() => setCollectionOpen(false)} />;

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
        <HStack gap="sm">
          <Button variant="ghost" size="xs" onClick={() => setCollectionOpen(true)}>
            Planner
          </Button>
          <Text textStyle="label/S/medium" color="fg.muted">
            / PS-118
          </Text>
          <Badge variant="ticket">Proposal</Badge>
        </HStack>
        <Button variant="ghost" size="xs" onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen}>
          <MessageSquare />
          Comments <Badge variant="number">{review.openCount}</Badge>
        </Button>
      </HStack>
      <Flex flex="1" minH="0" direction={{ base: "column", md: "row" }}>
        <Box css={styles}>
          <MarkdownEditor
            defaultState={review.markdown}
            isEditable
            onChange={review.setMarkdown}
            onComment={() => {
              if (editorRef.current) selectComment(editorRef.current, onSelect);
            }}
            reviewPlugin={
              <ReviewPlugin
                threads={review.threads}
                onTextChange={review.setDocumentText}
                showResolved={review.showResolved}
                onSelect={onSelect}
                onOpen={(id) => {
                  review.openThread(id);
                  setPanelOpen(true);
                }}
                onReady={(editor) => {
                  editorRef.current = editor;
                }}
              />
            }
          />
        </Box>
        {panelOpen && <CommentPanel review={review} onClose={() => setPanelOpen(false)} />}
      </Flex>
      {showMarkdown && (
        <ScrollArea maxH="48" borderTopWidth="1px" borderColor="border.subtle">
          <Box as="pre" p="sm" whiteSpace="pre-wrap" textStyle="paragraph/S/regular">
            {review.markdown}
          </Box>
        </ScrollArea>
      )}
      <HStack px="sm" py="xs" gap="md" flexWrap="wrap" borderTopWidth="1px" borderColor="border.subtle">
        <Badge variant="chip">Prototype controls</Badge>
        <Switch checked={review.failHandoff} onCheckedChange={({ checked }) => review.setFailHandoff(checked)}>
          Fail handoffs
        </Switch>
        <Switch checked={showMarkdown} onCheckedChange={({ checked }) => setShowMarkdown(checked)}>
          Show Markdown
        </Switch>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            review.setThreads([]);
            review.setDraft(null);
            review.setActiveId(null);
          }}
        >
          Clear comments
        </Button>
      </HStack>
      <HandoffDialog review={review} />
      <SessionPreview review={review} />
    </Stack>
  );
}

export function TicketReviewPrototype() {
  const [version, setVersion] = useState(0);
  return (
    <Stack w="full" h="full" minH="0" gap="0">
      <HStack justify="end" px="sm" py="xs" bg="bg" borderBottomWidth="1px" borderColor="border.subtle">
        <Button variant="ghost" size="xs" onClick={() => setVersion(version + 1)}>
          <RotateCcw />
          Reset prototype
        </Button>
      </HStack>
      <Box flex="1" minH="0">
        <TicketReview key={version} />
      </Box>
    </Stack>
  );
}
