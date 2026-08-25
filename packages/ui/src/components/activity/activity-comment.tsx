import type { HTMLChakraProps, RecipeVariantProps } from "@chakra-ui/react";
import { Box, createSlotRecipeContext, HStack, Stack, Text } from "@chakra-ui/react";
import { Children, type ReactNode } from "react";

import { activityCommentSlotRecipe as recipe } from "@/theme/recipes/activity-comment";
import type { ActivityActor } from "./activity.types";
import { ActivityAvatar } from "./activity-avatar";

const { withContext, withProvider } = createSlotRecipeContext({ recipe });

type ActivityCommentVariantProps = RecipeVariantProps<typeof recipe>;

interface ActivityCommentHeaderProps {
  actor: ActivityActor;
  icon?: ReactNode;
  iconColor?: string;
  iconBackground?: string;
  timestamp?: ReactNode;
  actions?: ReactNode;
}

interface ActivityCommentRootProps extends HTMLChakraProps<"article">, ActivityCommentVariantProps {}

export interface ActivityCommentProps extends Omit<ActivityCommentRootProps, "title"> {
  actor: ActivityActor;
  icon?: ReactNode;
  iconColor?: string;
  iconBackground?: string;
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
  const { actor, icon, iconColor, iconBackground, timestamp, actions } = props;

  return (
    <HStack gap="xs" alignItems="center" minW="0">
      <ActivityAvatar actor={actor} icon={icon} color={iconColor} background={iconBackground} />
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

const ActivityCommentRoot = withProvider<HTMLDivElement, ActivityCommentRootProps>("article", "root");
const ActivityCommentBody = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "body");
const ActivityCommentContent = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "content");

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
  const { actor, icon, iconColor, iconBackground, timestamp, actions, replies, composer, children, ...rootProps } =
    props;
  const hasReplies = Children.count(replies) > 0;

  return (
    <ActivityCommentRoot {...rootProps}>
      <ActivityCommentBody>
        <ActivityCommentHeader
          actor={actor}
          icon={icon}
          iconColor={iconColor}
          iconBackground={iconBackground}
          timestamp={timestamp}
          actions={actions}
        />
        <ActivityCommentContent>{children}</ActivityCommentContent>
      </ActivityCommentBody>
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
    </ActivityCommentRoot>
  );
};
