import type { TimelineRootProps } from "@chakra-ui/react";
import { Timeline } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface ActivityTimelineProps extends TimelineRootProps {
  children: ReactNode;
}

export const ActivityTimeline = (props: ActivityTimelineProps) => {
  const { children, ...rootProps } = props;

  return (
    <Timeline.Root size="sm" variant="plain" width="full" css={{ "--timeline-indicator-size": "18px" }} {...rootProps}>
      {children}
    </Timeline.Root>
  );
};
