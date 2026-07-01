import type { HTMLChakraProps } from "@chakra-ui/react";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Children, type ReactNode } from "react";

import type { ActivityActor } from "./activity.types";
import { ActivityAvatar } from "./activity-avatar";

interface ActivityCommentHeaderProps {
  actor: ActivityActor;
  timestamp?: ReactNode;
  actions?: ReactNode;
}

export interface ActivityCommentProps extends Omit<HTMLChakraProps<"article">, "title"> {
  actor: ActivityActor;
  timestamp?: ReactNode;
  actions?: ReactNode;
  replies?: ReactNode;
  composer?: ReactNode;
  children: ReactNode;
}

export interface ActivityReplyProps extends Omit<HTMLChakraProps<"div">, "title"> {
  actor: ActivityActor;
  timestamp?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

const TimestampSeparator = () => (
  <Box as="span" boxSize="3px" borderRadius="full" background="fg.subtle" flexShrink={0} />
);

const ActivityCommentHeader = (props: ActivityCommentHeaderProps) => {
  const { actor, timestamp, actions } = props;

  return (
    <HStack gap="xs" alignItems="center" minW="0">
      <ActivityAvatar actor={actor} />
      <Text textStyle="label/S/medium" color="fg" truncate>
        {actor.name}
      </Text>
      {timestamp ? (
        <>
          <TimestampSeparator />
          <Text textStyle="label/S/regular" color="fg.muted" flexShrink={0}>
            {timestamp}
          </Text>
        </>
      ) : null}
      <Box marginLeft="auto" flexShrink={0}>
        {actions}
      </Box>
    </HStack>
  );
};

export const ActivityReply = (props: ActivityReplyProps) => {
  const { actor, timestamp, actions, children, ...rootProps } = props;

  return (
    <Box paddingX="md" paddingY="sm" {...rootProps}>
      <Stack gap="xs">
        <ActivityCommentHeader actor={actor} timestamp={timestamp} actions={actions} />
        <Box paddingLeft="32px">
          <Text as="div" textStyle="label/S/regular" color="fg" overflowWrap="anywhere">
            {children}
          </Text>
        </Box>
      </Stack>
    </Box>
  );
};

export const ActivityComment = (props: ActivityCommentProps) => {
  const { actor, timestamp, actions, replies, composer, children, ...rootProps } = props;
  const hasReplies = Children.count(replies) > 0;

  return (
    <Box
      as="article"
      width="full"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="xs"
      background="bg"
      overflow="hidden"
      {...rootProps}
    >
      <Stack gap="sm" padding="md">
        <ActivityCommentHeader actor={actor} timestamp={timestamp} actions={actions} />
        <Text as="div" textStyle="label/S/regular" color="fg" overflowWrap="anywhere" whiteSpace="pre-wrap">
          {children}
        </Text>
      </Stack>
      {hasReplies ? (
        <Box borderTopWidth="1px" borderColor="border.subtle">
          {replies}
        </Box>
      ) : null}
      {composer ? (
        <Box borderTopWidth="1px" borderColor="border.subtle">
          {composer}
        </Box>
      ) : null}
    </Box>
  );
};
