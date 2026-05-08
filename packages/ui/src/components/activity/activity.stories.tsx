import { Box, HStack, Icon, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Circle, CircleDot, MoreHorizontal, Paperclip, Pin, PinOff, Tag, Trash2 } from "lucide-react";
import { useState } from "react";

import { Activity, type ActivityActor } from "./index";

const author: ActivityActor = {
  name: "Jordan Lee",
};

const bot: ActivityActor = {
  name: "System",
};

interface StoryReply {
  id: string;
  body: string;
  timestamp: string;
}

interface StoryComment {
  id: string;
  body: string;
  timestamp: string;
  replies: StoryReply[];
  isPinned?: boolean;
}

interface StoryAttachment {
  id: string;
  timestamp: string;
}

interface CommentActionsProps {
  comment: StoryComment;
  onDelete: (commentId: string) => void;
  onTogglePin: (commentId: string) => void;
}

interface StoryActivityCommentProps {
  comment: StoryComment;
  onAttach: () => void;
  onDelete: (commentId: string) => void;
  onReplySubmit: (commentId: string, body: string) => void;
  onTogglePin: (commentId: string) => void;
}

const initialComments: StoryComment[] = [
  {
    id: "opening-comment",
    body: "teest\n\n\nasdasdas as",
    timestamp: "2mo ago",
    replies: [{ id: "opening-reply", body: "this is a reply", timestamp: "just now" }],
  },
  {
    id: "latest-comment",
    body: "another message",
    timestamp: "just now",
    replies: [],
  },
];

const meta: Meta = {
  title: "Components/Activity",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box
        height="100vh"
        overflowY="auto"
        overflowX="hidden"
        background="bg"
        color="fg"
        padding={{ base: "md", md: "xl" }}
      >
        <Box width="full" maxWidth="820px" marginX="auto">
          <Story />
        </Box>
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj;

const createStoryId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const CommentActions = (props: CommentActionsProps) => {
  const { comment, onDelete, onTogglePin } = props;

  return (
    <HStack gap="2xs">
      {comment.isPinned ? (
        <Text textStyle="label/XS/medium" color="fg.muted">
          Pinned
        </Text>
      ) : null}
      <Menu.Root positioning={{ placement: "bottom-end" }}>
        <Menu.Trigger asChild>
          <IconButton size="2xs" variant="ghost" aria-label="Comment actions">
            <Icon as={MoreHorizontal} boxSize="14px" />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="180px" bg="bg">
              <Menu.Item value="pin-comment" onClick={() => onTogglePin(comment.id)}>
                <Icon as={comment.isPinned ? PinOff : Pin} boxSize="14px" />
                <Text>{comment.isPinned ? "Unpin comment" : "Pin comment"}</Text>
              </Menu.Item>
              <Menu.Item value="delete-comment" color="red.fg" onClick={() => onDelete(comment.id)}>
                <Icon as={Trash2} boxSize="14px" />
                <Text>Delete comment</Text>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </HStack>
  );
};

const StoryActivityComment = (props: StoryActivityCommentProps) => {
  const { comment, onAttach, onDelete, onReplySubmit, onTogglePin } = props;

  return (
    <Activity.Comment
      actor={author}
      timestamp={comment.timestamp}
      actions={<CommentActions comment={comment} onDelete={onDelete} onTogglePin={onTogglePin} />}
      replies={comment.replies.map((reply) => (
        <Activity.Reply key={reply.id} actor={author} timestamp={reply.timestamp}>
          {reply.body}
        </Activity.Reply>
      ))}
      composer={
        <Activity.Composer
          actor={author}
          variant="inline"
          placeholder="Leave a reply..."
          onAttach={onAttach}
          onSubmit={(body) => onReplySubmit(comment.id, body)}
        />
      }
    >
      {comment.body}
    </Activity.Comment>
  );
};

const FeatureLabel = () => (
  <HStack as="span" gap="2xs" whiteSpace="nowrap">
    <Text as="span">added label</Text>
    <Box as="span" boxSize="6px" borderRadius="full" background="purple.400" />
    <Text as="span" color="fg">
      Feature
    </Text>
  </HStack>
);

const ActivitySetupExample = () => {
  const [comments, setComments] = useState(initialComments);
  const [attachments, setAttachments] = useState<StoryAttachment[]>([]);

  const firstComment = comments.find((comment) => comment.id === "opening-comment");
  const timelineComments = comments.filter((comment) => comment.id !== "opening-comment");

  const handleAttach = () => {
    setAttachments((current) => [
      ...current,
      { id: createStoryId("attachment"), timestamp: current.length === 0 ? "just now" : "now" },
    ]);
  };

  const handleCommentSubmit = (body: string) => {
    setComments((current) => [
      ...current,
      {
        id: createStoryId("comment"),
        body,
        timestamp: "just now",
        replies: [],
      },
    ]);
  };

  const handleReplySubmit = (commentId: string, body: string) => {
    setComments((current) =>
      current.map((comment) => {
        if (comment.id !== commentId) return comment;

        return {
          ...comment,
          replies: [...comment.replies, { id: createStoryId("reply"), body, timestamp: "just now" }],
        };
      }),
    );
  };

  const handleTogglePin = (commentId: string) => {
    setComments((current) =>
      current.map((comment) => {
        if (comment.id !== commentId) return comment;

        return { ...comment, isPinned: !comment.isPinned };
      }),
    );
  };

  const handleDelete = (commentId: string) => {
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  };

  return (
    <Box>
      <Activity.Root>
        <Activity.Header />
        <Activity.Feed>
          <Activity.Timeline>
            <Activity.Event
              actor={bot}
              icon={<Circle size={8} fill="currentColor" />}
              iconColor="fg.muted"
              timestamp="3mo ago"
            >
              created the issue
            </Activity.Event>
          </Activity.Timeline>

          {firstComment ? (
            <StoryActivityComment
              comment={firstComment}
              onAttach={handleAttach}
              onDelete={handleDelete}
              onReplySubmit={handleReplySubmit}
              onTogglePin={handleTogglePin}
            />
          ) : null}

          <Activity.Timeline>
            <Activity.Event actor={author} icon={<CircleDot size={12} />} iconColor="yellow.400" timestamp="2mo ago">
              moved from Todo to In Progress
            </Activity.Event>

            <Activity.Event actor={author} icon={<MoreHorizontal size={12} />} timestamp="7w ago">
              set priority to High, then removed priority
            </Activity.Event>
          </Activity.Timeline>

          {timelineComments.map((comment) => (
            <StoryActivityComment
              key={comment.id}
              comment={comment}
              onAttach={handleAttach}
              onDelete={handleDelete}
              onReplySubmit={handleReplySubmit}
              onTogglePin={handleTogglePin}
            />
          ))}

          <Activity.Timeline>
            <Activity.Event actor={author} icon={<Tag size={12} />} timestamp="just now">
              <FeatureLabel />
            </Activity.Event>

            {attachments.map((attachment) => (
              <Activity.Event
                key={attachment.id}
                actor={author}
                icon={<Paperclip size={12} />}
                timestamp={attachment.timestamp}
              >
                attached a file
              </Activity.Event>
            ))}
          </Activity.Timeline>

          <Activity.Composer
            actor={author}
            placeholder="Leave a comment..."
            onAttach={handleAttach}
            onSubmit={handleCommentSubmit}
          />
        </Activity.Feed>
      </Activity.Root>
    </Box>
  );
};

export const Setup: Story = {
  render: () => <ActivitySetupExample />,
};
