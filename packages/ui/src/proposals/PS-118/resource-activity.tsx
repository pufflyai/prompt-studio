import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Check, ExternalLink, FilePenLine, History, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Activity } from "@/components/activity";
import { AlertMessage } from "@/components/primitives/alert";
import { CommentComposer } from "./comment-composer";
import { author, type ResourceEvent, type ReviewEntry, type ReviewThread } from "./review-fixtures";
import { findQuote } from "./review-text";
import type { ResourceActivityController } from "./use-resource-activity";

interface ResourceActivityProps {
  controller: ResourceActivityController;
}
interface ThreadProps {
  thread: ReviewThread;
  controller: ResourceActivityController;
}

function EntryBody({
  entry,
  thread,
  controller,
}: {
  entry: ReviewEntry;
  thread: ReviewThread;
  controller: ResourceActivityController;
}) {
  return (
    <Stack gap="xs">
      <Text whiteSpace="pre-wrap" overflowWrap="anywhere">
        {entry.text}
      </Text>
      {entry.target && (
        <Badge variant="chip" alignSelf="start">
          @{entry.target.handle}
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
          endElement={<Button onClick={() => controller.startHandoff(thread, entry)}>Retry handoff</Button>}
        >
          Your comment is kept.
        </AlertMessage>
      )}
      {entry.session && (
        <Button variant="ghost" size="xs" alignSelf="start" onClick={() => controller.setSession(entry.session)}>
          <ExternalLink />
          Open session · 0.6s
        </Button>
      )}
    </Stack>
  );
}

function ActivityThread({ thread, controller }: ThreadProps) {
  const root = useRef<HTMLDivElement>(null);
  const first = thread.entries[0];
  const draft = controller.draft?.threadId === thread.id ? controller.draft : undefined;
  const isReplying = Boolean(draft);
  useEffect(() => {
    if (!controller.focusRequest || controller.activeId !== thread.id) return;
    root.current?.scrollIntoView({ block: "center" });
    if (isReplying) root.current?.querySelector("textarea")?.focus();
    else root.current?.focus({ preventScroll: true });
  }, [controller.activeId, controller.focusRequest, isReplying, thread.id]);
  return (
    <Box ref={root} tabIndex={-1} aria-label="Activity comment">
      <Activity.Comment
        actor={author}
        timestamp={thread.timestamp ?? "Just now"}
        actions={
          <HStack gap="xs">
            {thread.resolved && (
              <Badge variant="chip">
                <Check />
                Resolved
              </Badge>
            )}
            <Button variant="ghost" size="2xs" onClick={() => controller.resolve(thread)}>
              {thread.resolved ? <RotateCcw /> : <Check />}
              {thread.resolved ? "Reopen" : "Resolve"}
            </Button>
          </HStack>
        }
        replies={thread.entries.slice(1).map((entry) => (
          <Activity.Reply key={entry.id} actor={author} timestamp="Just now">
            <EntryBody entry={entry} thread={thread} controller={controller} />
          </Activity.Reply>
        ))}
        composer={
          draft ? (
            <CommentComposer draft={draft} onChange={controller.setDraft} onSubmit={controller.submit} />
          ) : undefined
        }
      >
        <Stack gap="sm">
          {thread.quote && (
            <Stack gap="xs">
              <Text color="fg.muted" textStyle="paragraph/S/regular">
                “{thread.quote}”
              </Text>
              {!findQuote(controller.documentText, thread.quote) && (
                <Badge variant="chip" alignSelf="start">
                  Text no longer in resource
                </Badge>
              )}
            </Stack>
          )}
          {first && <EntryBody entry={first} thread={thread} controller={controller} />}
          {!draft && (
            <Button alignSelf="start" variant="ghost" size="2xs" onClick={() => controller.reply(thread)}>
              Reply
            </Button>
          )}
        </Stack>
      </Activity.Comment>
    </Box>
  );
}

function ChangeEvent({ event, controller }: { event: ResourceEvent; controller: ResourceActivityController }) {
  return (
    <Activity.Timeline>
      <Activity.Event actor={event.actor} icon={<History />} timestamp={event.timestamp}>
        {event.message}
        {event.change && (
          <Button variant="ghost" size="2xs" onClick={() => controller.setChange(event.change)}>
            <FilePenLine />
            View change
          </Button>
        )}
      </Activity.Event>
    </Activity.Timeline>
  );
}

export function ResourceActivity({ controller }: ResourceActivityProps) {
  const [filter, setFilter] = useState("all");
  const composer = useRef<HTMLDivElement>(null);
  const state = controller.activity;
  const draft = controller.draft;
  useEffect(() => {
    if (!controller.focusRequest) return;
    setFilter("all");
    if (controller.activeId) return;
    composer.current?.scrollIntoView({ block: "center" });
    composer.current?.querySelector("textarea")?.focus();
  }, [controller.focusRequest, controller.activeId]);
  if (!state) return null;
  const items = state.items.filter(
    (item) => filter === "all" || (filter === "comments" ? item.kind === "comment" : item.kind === "event"),
  );
  return (
    <Activity.Root aria-label="Resource activity">
      <Activity.Header
        actions={
          state.trackChanges && (
            <HStack gap="xs">
              {[
                ["all", "All activity"],
                ["comments", "Comments"],
                ["changes", "Changes"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="xs"
                  variant={filter === value ? "subtle" : "ghost"}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </HStack>
          )
        }
      />
      <Activity.Feed>
        {items.map((item) =>
          item.kind === "event" ? (
            <ChangeEvent key={item.id} event={item} controller={controller} />
          ) : (
            <ActivityThread key={item.id} thread={item} controller={controller} />
          ),
        )}
        {items.length === 0 && (
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            No activity yet
          </Text>
        )}
        {state.comments && draft && !draft.threadId && (
          <Box ref={composer}>
            <CommentComposer draft={draft} onChange={controller.setDraft} onSubmit={controller.submit} />
          </Box>
        )}
      </Activity.Feed>
    </Activity.Root>
  );
}
