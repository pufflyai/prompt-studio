import { ActivityAvatar } from "./activity-avatar";
import { ActivityComment, ActivityReply } from "./activity-comment";
import { ActivityComposer } from "./activity-composer";
import { ActivityEvent } from "./activity-event";
import { ActivityFeed, ActivityHeader, ActivityRoot } from "./activity-root";
import { ActivityTimeline } from "./activity-timeline";

export type { ActivityActor } from "./activity.types";
export type { ActivityAvatarProps } from "./activity-avatar";
export type { ActivityCommentProps, ActivityReplyProps } from "./activity-comment";
export type { ActivityComposerProps } from "./activity-composer";
export type { ActivityEventProps } from "./activity-event";
export type { ActivityFeedProps, ActivityHeaderProps, ActivityRootProps } from "./activity-root";
export type { ActivityTimelineProps } from "./activity-timeline";

export {
  ActivityAvatar,
  ActivityComment,
  ActivityComposer,
  ActivityEvent,
  ActivityFeed,
  ActivityHeader,
  ActivityReply,
  ActivityRoot,
  ActivityTimeline,
};

export const Activity = {
  Root: ActivityRoot,
  Header: ActivityHeader,
  Feed: ActivityFeed,
  Timeline: ActivityTimeline,
  Event: ActivityEvent,
  Comment: ActivityComment,
  Reply: ActivityReply,
  Composer: ActivityComposer,
  Avatar: ActivityAvatar,
};
