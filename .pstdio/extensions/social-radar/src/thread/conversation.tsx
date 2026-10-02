import { Badge, Box, Heading, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import { EmptyState, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { ArrowBigUp } from "lucide-react";
import type { ReactNode } from "react";
import type { FoundThread, Idea, NewPost, SnapshotComment } from "../schemas";
import { ReplyIdea } from "./reply-idea";

const ago = (value?: string) => {
  if (!value) return "";
  const hours = Math.round((Date.now() - Date.parse(value)) / 3_600_000);
  if (hours < 24) return `${Math.max(hours, 1)}h`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

interface CommentProps {
  comment: SnapshotComment;
  op?: string;
  children?: ReactNode;
}
const Comment = (props: CommentProps) => {
  const { comment, op, children } = props;
  const body = (
    <Stack gap="xs">
      <HStack gap="xs">
        <Text textStyle="label/S/medium">{comment.author}</Text>
        {comment.author === op ? <Badge size="xs">OP</Badge> : null}
        {comment.mine ? (
          <Badge size="xs" colorPalette="green">
            Your reply
          </Badge>
        ) : null}
        <Text textStyle="label/XS" color="fg.muted">
          {ago(comment.publishedAt)}
        </Text>
      </HStack>
      <Text textStyle="paragraph/S/regular" whiteSpace="pre-wrap">
        {comment.body}
      </Text>
      {comment.votes === undefined ? null : (
        <HStack gap="2xs" color="fg.muted">
          <ArrowBigUp size={14} />
          <Text textStyle="label/XS">{comment.votes}</Text>
        </HStack>
      )}
    </Stack>
  );
  return (
    <Stack gap="sm">
      {comment.mine ? (
        <SimpleCard bg="bg.subtle">
          <SimpleCardBody>{body}</SimpleCardBody>
        </SimpleCard>
      ) : (
        body
      )}
      {children}
    </Stack>
  );
};

interface ConversationProps {
  thread: FoundThread | NewPost;
  ideas: Idea[];
  onEditIdea: (id: string, body: string) => void;
  onIdeaStatus: (id: string, status: Idea["status"]) => void;
}
/** Draws the thread as it looked on the site, with each reply idea under the comment it answers. */
export const Conversation = (props: ConversationProps) => {
  const { thread, ideas, onEditIdea, onIdeaStatus } = props;
  const snapshot = thread.snapshot;
  const open = ideas.filter((idea) => idea.status !== "dismissed");
  const ideasFor = (commentId?: string) =>
    open
      .filter((idea) => idea.replyTo === commentId)
      .map((idea) => (
        <ReplyIdea
          key={idea.id}
          idea={idea}
          onEdit={(body) => onEditIdea(idea.id, body)}
          onStatus={(status) => onIdeaStatus(idea.id, status)}
        />
      ));
  const replies = (parentId?: string): ReactNode[] =>
    (snapshot?.comments ?? [])
      .filter((comment) => comment.parentId === parentId)
      .map((comment) => (
        <Box
          key={comment.id}
          ps={parentId ? "md" : "0"}
          borderStartWidth={parentId ? "2px" : "0"}
          borderColor="border.subtle"
        >
          <Comment comment={comment} op={snapshot?.post.author}>
            {ideasFor(comment.id)}
            {replies(comment.id)}
          </Comment>
        </Box>
      ));
  if (!snapshot)
    return <EmptyState title="No snapshot yet" description="The next run saves the post and its top comments here." />;
  return (
    <Stack gap="md">
      <HStack justify="space-between">
        <Text textStyle="label/S/regular" color="fg.muted">
          {[snapshot.post.author, ago(snapshot.post.publishedAt)].filter(Boolean).join(" · ")}
        </Text>
        <Text textStyle="label/XS" color="fg.muted">
          Snapshot from {new Date(snapshot.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Text>
      </HStack>
      <Heading as="h1" textStyle="heading/M">
        {thread.title}
      </Heading>
      <Text textStyle="paragraph/M/regular" whiteSpace="pre-wrap">
        {snapshot.post.body}
      </Text>
      {ideasFor(undefined)}
      <Separator />
      <Text textStyle="label/S/medium">Comments · top</Text>
      <Stack gap="lg">{replies(undefined)}</Stack>
    </Stack>
  );
};
