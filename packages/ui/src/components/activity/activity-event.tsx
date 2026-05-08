import type { TimelineItemProps } from "@chakra-ui/react";
import { Box, Text, Timeline } from "@chakra-ui/react";
import type { ReactNode } from "react";

import type { ActivityActor } from "./activity.types";
import { ActivityAvatar } from "./activity-avatar";

export interface ActivityEventProps extends Omit<TimelineItemProps, "title"> {
  actor?: ActivityActor;
  icon?: ReactNode;
  iconColor?: string;
  iconBackground?: string;
  timestamp?: ReactNode;
  children: ReactNode;
}

const EventSeparator = () => <Box as="span" boxSize="3px" borderRadius="full" background="fg.subtle" flexShrink={0} />;

export const ActivityEvent = (props: ActivityEventProps) => {
  const {
    actor,
    icon,
    iconColor = "fg.muted",
    iconBackground = "transparent",
    timestamp,
    children,
    ...rootProps
  } = props;

  return (
    <Timeline.Item gap="xs" minH="24px" paddingX="md" {...rootProps}>
      <Timeline.Connector>
        <Timeline.Separator borderColor="border.muted" />
        <Timeline.Indicator outline="none" shadow="none" border="none" background="transparent">
          <ActivityAvatar actor={actor} icon={icon} color={iconColor} background={iconBackground} />
        </Timeline.Indicator>
      </Timeline.Connector>
      <Timeline.Content gap="0" paddingBottom="xs" minW="0">
        <Timeline.Title
          marginTop="0"
          gap="xs"
          minW="0"
          fontWeight="normal"
          textStyle="label/S/regular"
          color="fg.muted"
        >
          {actor ? (
            <Text as="span" color="fg" fontWeight="500" flexShrink={0}>
              {actor.name}
            </Text>
          ) : null}
          <Box as="span" display="inline-flex" alignItems="center" gap="2xs" minW="0" flexWrap="wrap">
            {children}
          </Box>
          {timestamp ? (
            <>
              <EventSeparator />
              <Text as="span" color="fg.muted" flexShrink={0}>
                {timestamp}
              </Text>
            </>
          ) : null}
        </Timeline.Title>
      </Timeline.Content>
    </Timeline.Item>
  );
};
