import type { StackProps } from "@chakra-ui/react";
import { Button, HStack, Icon, Spinner, Stack, Text } from "@chakra-ui/react";
import {
  Activity,
  Bell,
  CircleAlert,
  Component,
  ExternalLink,
  GitBranch,
  Info,
  MessageCircle,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { AlertMessage } from "@/components/primitives/alert";
import { EmptyState } from "@/components/primitives/empty-state";
import { RichMessage } from "@/components/rich-text";
import type { ActivityActor } from "./activity.types";
import { ActivityComment } from "./activity-comment";
import { ActivityEvent } from "./activity-event";
import { ActivityFeed } from "./activity-root";
import { ActivityTimeline } from "./activity-timeline";

export type ResourceActivityFeedSize = "comfortable" | "compact";

export type ResourceActivityIconName =
  | "activity"
  | "bell"
  | "circle-alert"
  | "component"
  | "external-link"
  | "git-branch"
  | "info"
  | "message-circle"
  | "scan-search"
  | "sparkles";

export interface ResourceActivityRelatedResource {
  id: string;
  type: string;
  label: string;
}

export interface ResourceActivityFeedAction {
  id: string;
  label: string;
  icon?: ResourceActivityIconName;
}

export interface ResourceActivityFeedAttention {
  statusLabel?: string;
  icon?: ResourceActivityIconName;
  actions?: readonly ResourceActivityFeedAction[];
}

interface ResourceActivityFeedItemBase {
  id: string;
  createdAt: string;
  timestampLabel?: string;
  actor?: ActivityActor;
  icon?: ResourceActivityIconName;
  relatedResources?: readonly ResourceActivityRelatedResource[];
}

export interface ResourceActivityFeedEventItem extends ResourceActivityFeedItemBase {
  kind: "event";
  summary: string;
}

export interface ResourceActivityFeedMessageItem extends ResourceActivityFeedItemBase {
  kind: "message";
  markdown: string;
  attention?: ResourceActivityFeedAttention;
}

export type ResourceActivityFeedItem = ResourceActivityFeedEventItem | ResourceActivityFeedMessageItem;

export interface ResourceActivityFeedProps extends Omit<StackProps, "children"> {
  items: readonly ResourceActivityFeedItem[];
  size?: ResourceActivityFeedSize;
  isLoading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  loadMoreLabel?: string;
  loadingLabel?: string;
  fallbackActorName?: string;
  formatTimestamp?: (createdAt: string, item: ResourceActivityFeedItem) => ReactNode;
  onActionSelect?: (action: ResourceActivityFeedAction, item: ResourceActivityFeedMessageItem) => void;
  onLoadMore?: () => void;
  onRelatedResourceSelect?: (resource: ResourceActivityRelatedResource, item: ResourceActivityFeedItem) => void;
}

interface ItemActionsProps {
  item: ResourceActivityFeedItem;
  size: ResourceActivityFeedSize;
  onActionSelect?: ResourceActivityFeedProps["onActionSelect"];
  onRelatedResourceSelect?: ResourceActivityFeedProps["onRelatedResourceSelect"];
}

interface ResourceActivityItemProps extends ItemActionsProps {
  fallbackActorName: string;
  formatTimestamp: NonNullable<ResourceActivityFeedProps["formatTimestamp"]>;
}

const iconComponents: Record<ResourceActivityIconName, ComponentType> = {
  activity: Activity,
  bell: Bell,
  "circle-alert": CircleAlert,
  component: Component,
  "external-link": ExternalLink,
  "git-branch": GitBranch,
  info: Info,
  "message-circle": MessageCircle,
  "scan-search": ScanSearch,
  sparkles: Sparkles,
};

const ActivityIcon = (props: { name: ResourceActivityIconName }) => {
  const IconComponent = iconComponents[props.name];
  return <Icon as={IconComponent} boxSize="13px" />;
};

const ItemActions = (props: ItemActionsProps) => {
  const { item, size, onActionSelect, onRelatedResourceSelect } = props;
  const attentionActions = item.kind === "message" ? item.attention?.actions : undefined;
  if (!item.relatedResources?.length && !attentionActions?.length) return null;

  return (
    <HStack gap="2xs" flexWrap="wrap">
      {attentionActions?.map((action) => (
        <Button
          key={action.id}
          type="button"
          size={size === "compact" ? "2xs" : "xs"}
          variant="outline"
          disabled={!onActionSelect}
          onClick={() => onActionSelect?.(action, item as ResourceActivityFeedMessageItem)}
        >
          {action.icon ? <ActivityIcon name={action.icon} /> : null}
          {action.label}
        </Button>
      ))}
      {item.relatedResources?.map((resource) => (
        <Button
          key={`${resource.type}:${resource.id}`}
          type="button"
          size={size === "compact" ? "2xs" : "xs"}
          variant="ghost"
          disabled={!onRelatedResourceSelect}
          onClick={() => onRelatedResourceSelect?.(resource, item)}
        >
          {resource.label}
        </Button>
      ))}
    </HStack>
  );
};

const AttentionStatus = (props: { attention: ResourceActivityFeedAttention }) => {
  const { attention } = props;
  if (!attention.statusLabel) return null;

  return (
    <HStack gap="2xs" color="fg.warning">
      <ActivityIcon name={attention.icon ?? "bell"} />
      <Text textStyle="label/XS/medium">{attention.statusLabel}</Text>
    </HStack>
  );
};

const ResourceActivityItem = (props: ResourceActivityItemProps) => {
  const { item, size, fallbackActorName, formatTimestamp, onActionSelect, onRelatedResourceSelect } = props;
  const actor = item.actor ?? { name: fallbackActorName };
  const timestamp = (
    <time dateTime={item.createdAt}>{item.timestampLabel ?? formatTimestamp(item.createdAt, item)}</time>
  );

  if (item.kind === "event") {
    return (
      <ActivityTimeline>
        <ActivityEvent
          actor={actor}
          icon={item.icon ? <ActivityIcon name={item.icon} /> : undefined}
          timestamp={timestamp}
          paddingX={size === "compact" ? "sm" : "md"}
        >
          <Text as="span">{item.summary}</Text>
          <ItemActions item={item} size={size} onRelatedResourceSelect={onRelatedResourceSelect} />
        </ActivityEvent>
      </ActivityTimeline>
    );
  }

  const attentionIcon = item.attention?.icon ?? "bell";

  return (
    <ActivityComment
      actor={actor}
      icon={item.attention ? <ActivityIcon name={attentionIcon} /> : undefined}
      iconColor={item.attention ? "fg.warning" : undefined}
      iconBackground={item.attention ? "bg.warning" : undefined}
      timestamp={timestamp}
      actions={item.attention ? <AttentionStatus attention={item.attention} /> : undefined}
      tone={item.attention ? "attention" : "default"}
      size={size}
    >
      <Stack gap={size === "compact" ? "xs" : "sm"}>
        <RichMessage defaultState={item.markdown} fullWidth />
        <ItemActions
          item={item}
          size={size}
          onActionSelect={onActionSelect}
          onRelatedResourceSelect={onRelatedResourceSelect}
        />
      </Stack>
    </ActivityComment>
  );
};

const defaultFormatTimestamp = (createdAt: string) => createdAt;

export const ResourceActivityFeed = (props: ResourceActivityFeedProps) => {
  const {
    items,
    size = "comfortable",
    isLoading = false,
    error,
    hasMore = false,
    isLoadingMore = false,
    emptyTitle = "No activity yet",
    emptyDescription = "Events and messages will appear here.",
    errorTitle = "Activity unavailable",
    loadMoreLabel = "Load more",
    loadingLabel = "Loading activity",
    fallbackActorName = "System",
    formatTimestamp = defaultFormatTimestamp,
    onActionSelect,
    onLoadMore,
    onRelatedResourceSelect,
    ...rootProps
  } = props;

  if (error) {
    return (
      <AlertMessage status="error" colorPalette="red" title={errorTitle} size="sm" {...rootProps}>
        {error}
      </AlertMessage>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <HStack role="status" aria-live="polite" gap="xs" color="fg.muted" {...rootProps}>
        <Spinner size="sm" />
        <Text textStyle="label/S/regular">{loadingLabel}</Text>
      </HStack>
    );
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} {...rootProps} />;
  }

  return (
    <ActivityFeed gap={size === "compact" ? "sm" : "md"} {...rootProps}>
      {items.map((item) => (
        <ResourceActivityItem
          key={item.id}
          item={item}
          size={size}
          fallbackActorName={fallbackActorName}
          formatTimestamp={formatTimestamp}
          onActionSelect={onActionSelect}
          onRelatedResourceSelect={onRelatedResourceSelect}
        />
      ))}
      {hasMore ? (
        <Button
          type="button"
          width="full"
          size={size === "compact" ? "xs" : "sm"}
          variant="ghost"
          loading={isLoadingMore}
          onClick={onLoadMore}
        >
          {loadMoreLabel}
        </Button>
      ) : null}
    </ActivityFeed>
  );
};
