import { Badge, Button, HStack, IconButton, Separator, Stack, Text } from "@chakra-ui/react";
import { Check, ExternalLink, MessageSquare, RotateCcw, X } from "lucide-react";
import { AlertMessage } from "@/components/primitives/alert";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { CommentComposer } from "./comment-composer";
import type { ReviewThread } from "./review-fixtures";
import { findQuote } from "./review-text";
import type { ReviewPrototype } from "./use-review-prototype";

interface CommentPanelProps {
  review: ReviewPrototype;
  onClose: () => void;
}
interface ThreadProps {
  thread: ReviewThread;
  review: ReviewPrototype;
}

function CommentThread(props: ThreadProps) {
  const { thread, review } = props;
  const active = thread.id === review.activeId;
  const orphaned = !findQuote(review.documentText, thread.quote);

  return (
    <Stack gap="sm" p="sm" borderWidth="1px" borderColor={active ? "border.accent" : "border.subtle"} borderRadius="xs">
      <Button
        aria-label={`Open thread: ${thread.quote}`}
        variant="ghost"
        h="auto"
        whiteSpace="normal"
        justifyContent="start"
        onClick={() => review.openThread(thread.id)}
      >
        <Stack align="start" gap="xs" minW="0" textAlign="start">
          <HStack>
            <MessageSquare />
            <Text textStyle="label/S/medium">You</Text>
            <Text color="fg.muted" textStyle="label/XS">
              Just now
            </Text>
          </HStack>
          <Text textStyle="paragraph/S/regular" lineClamp={active ? undefined : 2}>
            “{thread.quote}”
          </Text>
          {orphaned && <Badge variant="chip">Text no longer in ticket</Badge>}
          {thread.resolved && (
            <Badge variant="chip">
              <Check />
              Resolved
            </Badge>
          )}
          {!active && (
            <Text color="fg.muted" textStyle="paragraph/S/regular" lineClamp={2}>
              {thread.entries[0]?.text}
            </Text>
          )}
        </Stack>
      </Button>
      {active && (
        <>
          {thread.entries.map((entry, index) => (
            <Stack key={entry.id} gap="xs">
              {index > 0 && (
                <>
                  <Separator />
                  <Text textStyle="label/S/medium">You · Just now</Text>
                </>
              )}
              <Text textStyle="paragraph/S/regular" whiteSpace="pre-wrap" overflowWrap="anywhere">
                {entry.text}
              </Text>
              {entry.target && (
                <Badge variant="chip" alignSelf="start" maxW="full">
                  <Text truncate>@{entry.target.handle}</Text>
                </Badge>
              )}
              {entry.handoff === "starting" && (
                <Button variant="ghost" size="xs" loading>
                  Starting session…
                </Button>
              )}
              {entry.handoff === "failed" && (
                <AlertMessage
                  status="error"
                  title="Session could not start"
                  endElement={<Button onClick={() => review.startHandoff(thread, entry)}>Retry handoff</Button>}
                >
                  Your comment is kept. Try starting the session again.
                </AlertMessage>
              )}
              {entry.session && (
                <Button variant="ghost" size="xs" alignSelf="start" onClick={() => review.setSession(entry.session)}>
                  <ExternalLink />
                  Open session · 0.6s
                </Button>
              )}
            </Stack>
          ))}
          <HStack justify="space-between">
            <Button variant="ghost" size="xs" onClick={() => review.reply(thread)}>
              Reply
            </Button>
            <Button variant="ghost" size="xs" onClick={() => review.resolve(thread.id)}>
              {thread.resolved ? <RotateCcw /> : <Check />}
              {thread.resolved ? "Reopen" : "Resolve"}
            </Button>
          </HStack>
          {review.draft?.threadId === thread.id && (
            <CommentComposer
              draft={review.draft}
              onChange={review.setDraft}
              onSubmit={review.submit}
              onCancel={() => review.setDraft(null)}
            />
          )}
        </>
      )}
    </Stack>
  );
}

export function CommentPanel(props: CommentPanelProps) {
  const { review, onClose } = props;
  const visible = review.threads.filter((thread) => thread.resolved === review.showResolved);
  return (
    <Stack
      as="aside"
      aria-label="Ticket comments"
      w="96"
      maxW="full"
      minH="0"
      gap="0"
      borderLeftWidth="1px"
      borderColor="border.subtle"
      bg="bg"
    >
      <HStack p="sm" justify="space-between">
        <Text textStyle="label/M/medium">Comments</Text>
        <IconButton variant="ghost" size="xs" aria-label="Close comments" onClick={onClose}>
          <X />
        </IconButton>
      </HStack>
      <HStack px="sm" pb="sm" gap="xs">
        <Button
          size="xs"
          variant={review.showResolved ? "ghost" : "subtle"}
          onClick={() => review.setShowResolved(false)}
        >
          Open {review.openCount}
        </Button>
        <Button
          size="xs"
          variant={review.showResolved ? "subtle" : "ghost"}
          onClick={() => review.setShowResolved(true)}
        >
          Resolved {review.threads.length - review.openCount}
        </Button>
      </HStack>
      <ScrollArea flex="1" minH="0" contentProps={{ p: "sm" }}>
        <Stack gap="sm">
          {review.draft && !review.draft.threadId && (
            <CommentComposer
              draft={review.draft}
              onChange={review.setDraft}
              onSubmit={review.submit}
              onCancel={() => review.setDraft(null)}
            />
          )}
          {visible.map((thread) => (
            <CommentThread key={thread.id} thread={thread} review={review} />
          ))}
          {visible.length === 0 && (
            <Text p="sm" color="fg.muted" textStyle="paragraph/S/regular">
              {review.showResolved ? "No resolved comments" : "No open comments"}
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
