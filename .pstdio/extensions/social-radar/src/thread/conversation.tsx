import { Badge, Box, Heading, HStack, Icon, Separator, Stack, Text } from "@chakra-ui/react";
import { Chip, EmptyState, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { ArrowBigUp } from "lucide-react";
import type { FoundThread, Idea, NewPost, SnapshotComment } from "../schemas";
import { LinkedText } from "./linked-text";
import { ReplyIdea } from "./reply-idea";
import { ThreadImages } from "./thread-images";

const ago = (value?: string) => {
  if (!value) return "";
  const hours = Math.round((Date.now() - Date.parse(value)) / 3_600_000);
  if (hours < 24) return `${Math.max(hours, 1)}h`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

interface CommentBodyProps {
  threadId: string;
  comment: SnapshotComment;
  op?: string;
}
const CommentBody = (props: CommentBodyProps) => {
  const { threadId, comment, op } = props;
  return (
    <Stack gap="xs">
      <HStack gap="xs">
        <Text textStyle="label/S/medium">{comment.author}</Text>
        {comment.author === op ? <Badge size="xs">OP</Badge> : null}
        {comment.mine ? (
          <Badge size="xs" colorPalette="green">
            Your reply
          </Badge>
        ) : null}
        <Text textStyle="label/XS" color="fg.muted" flex="1">
          {ago(comment.publishedAt)}
        </Text>
        {comment.topic ? <Chip>{comment.topic}</Chip> : null}
      </HStack>
      <LinkedText textStyle="paragraph/S/regular" whiteSpace="pre-wrap">
        {comment.body}
      </LinkedText>
      <ThreadImages threadId={threadId} images={comment.images} />
      {comment.votes === undefined ? null : (
        <HStack gap="2xs" color="fg.muted">
          <Icon as={ArrowBigUp} boxSize="icon-xs" />
          <Text textStyle="label/XS">{comment.votes}</Text>
        </HStack>
      )}
    </Stack>
  );
};

interface IdeaHandlers {
  ideas: Idea[];
  onEditIdea: (id: string, body: string) => void;
  onIdeaStatus: (id: string, status: Idea["status"]) => void;
}
interface IdeaListProps extends IdeaHandlers {
  replyTo?: string;
}
const IdeaList = (props: IdeaListProps) => {
  const { ideas, replyTo, onEditIdea, onIdeaStatus } = props;
  return ideas
    .filter((idea) => idea.replyTo === replyTo)
    .map((idea) => (
      <ReplyIdea
        key={idea.id}
        idea={idea}
        onEdit={(body) => onEditIdea(idea.id, body)}
        onStatus={(status) => onIdeaStatus(idea.id, status)}
      />
    ));
};

interface CommentTreeProps extends IdeaHandlers {
  threadId: string;
  comment: SnapshotComment;
  comments: SnapshotComment[];
  op?: string;
  nested?: boolean;
}
const CommentTree = (props: CommentTreeProps) => {
  const { threadId, comment, comments, op, nested = false, ...handlers } = props;
  const children = comments.filter((child) => child.parentId === comment.id);
  return (
    <Box ps={nested ? "md" : "0"} borderStartWidth={nested ? "1px" : "0"} borderColor="border.subtle">
      <Stack gap="sm">
        {comment.mine ? (
          <SimpleCard bg="bg.subtle">
            <SimpleCardBody>
              <CommentBody threadId={threadId} comment={comment} op={op} />
            </SimpleCardBody>
          </SimpleCard>
        ) : (
          <CommentBody threadId={threadId} comment={comment} op={op} />
        )}
        <IdeaList {...handlers} replyTo={comment.id} />
        {children.map((child) => (
          <CommentTree
            key={child.id}
            {...handlers}
            threadId={threadId}
            comment={child}
            comments={comments}
            op={op}
            nested
          />
        ))}
      </Stack>
    </Box>
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
  if (!snapshot)
    return <EmptyState title="No snapshot yet" description="The next run saves the post and its top comments here." />;
  const handlers = { ideas: ideas.filter((idea) => idea.status !== "dismissed"), onEditIdea, onIdeaStatus };
  const ids = new Set(snapshot.comments.map((comment) => comment.id));
  // A reply whose parent fell outside the saved top comments is drawn at the top level.
  const roots = snapshot.comments.filter((comment) => !comment.parentId || !ids.has(comment.parentId));
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
      <LinkedText textStyle="paragraph/M/regular" whiteSpace="pre-wrap">
        {snapshot.post.body}
      </LinkedText>
      <ThreadImages threadId={thread.id} images={snapshot.post.images} />
      <IdeaList {...handlers} />
      <Separator />
      <Text textStyle="label/S/medium">Comments · top</Text>
      <Stack gap="lg">
        {roots.map((comment) => (
          <CommentTree
            key={comment.id}
            {...handlers}
            threadId={thread.id}
            comment={comment}
            comments={snapshot.comments}
            op={snapshot.post.author}
          />
        ))}
      </Stack>
    </Stack>
  );
};
