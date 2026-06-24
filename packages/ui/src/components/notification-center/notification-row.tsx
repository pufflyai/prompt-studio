import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertTriangle, Eye, GitMerge, Info, ShieldCheck, XCircle } from "lucide-react";
import * as React from "react";
import {
  KIND_LABELS,
  type NotificationActionItem,
  type NotificationItem,
  type NotificationKind,
  type NotificationPriority,
} from "./notification-types";

const KIND_ICONS: Record<NotificationKind, React.ComponentType<{ size?: number }>> = {
  needs_review: Eye,
  ready_to_merge: GitMerge,
  blocked: AlertTriangle,
  approval_required: ShieldCheck,
  failed: XCircle,
  info: Info,
};

const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low: "gray",
  normal: "blue",
  high: "orange",
  urgent: "red",
};

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.round(diff / minute)} min ago`;
  if (diff < day) return `${Math.round(diff / hour)} h ago`;
  return `${Math.round(diff / day)} d ago`;
};

export interface NotificationRowProps {
  item: NotificationItem;
  active?: boolean;
  onInvokeAction: (action: NotificationActionItem) => void;
}

export const NotificationRow = React.forwardRef<HTMLDivElement, NotificationRowProps>(function NotificationRow(
  { item, active, onInvokeAction },
  ref,
) {
  const Icon = KIND_ICONS[item.kind] ?? Info;
  const primary = item.actions.find((a) => a.primary) ?? item.actions[0];

  return (
    <Box
      ref={ref}
      role="option"
      aria-selected={active ?? false}
      px="3"
      py="2"
      borderRadius="md"
      cursor={primary ? "pointer" : "default"}
      background={active ? "bg.muted" : undefined}
      onClick={() => primary && onInvokeAction(primary)}
      data-testid={`notification-row-${item.id}`}
    >
      <HStack align="start" gap="3">
        <Box pt="0.5" color="fg.muted" aria-hidden>
          <Icon size={16} />
        </Box>
        <Stack flex="1" gap="0.5">
          <HStack justify="space-between" align="center">
            <HStack gap="2">
              <Text fontSize="sm" fontWeight="semibold">
                {KIND_LABELS[item.kind] ?? item.kind}
              </Text>
              {item.priority !== "normal" && (
                <Badge size="xs" colorPalette={PRIORITY_COLORS[item.priority] ?? "gray"}>
                  {item.priority}
                </Badge>
              )}
            </HStack>
            <Text fontSize="xs" color="fg.muted">
              {formatRelative(item.updatedAt)}
            </Text>
          </HStack>
          <Text fontSize="sm" color="fg">
            {item.title}
          </Text>
          {item.body && (
            <Text fontSize="xs" color="fg.muted" lineClamp={2}>
              {item.body}
            </Text>
          )}
          <HStack gap="2" mt="1" align="center">
            {item.sourceLabel && (
              <Text fontSize="xs" color="fg.muted">
                {item.sourceLabel}
              </Text>
            )}
            {item.resourceLabel && (
              <Text fontSize="xs" color="fg.muted">
                {item.resourceLabel}
              </Text>
            )}
            {item.status === "snoozed" && item.snoozedUntil && (
              <Text fontSize="xs" color="fg.muted">
                Snoozed until {item.snoozedUntil}
              </Text>
            )}
            <Box flex="1" />
            {primary && (
              <Button
                size="xs"
                variant={primary.destructive ? "solid" : "subtle"}
                colorPalette={primary.destructive ? "red" : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  onInvokeAction(primary);
                }}
              >
                {primary.label}
              </Button>
            )}
          </HStack>
        </Stack>
      </HStack>
    </Box>
  );
});
