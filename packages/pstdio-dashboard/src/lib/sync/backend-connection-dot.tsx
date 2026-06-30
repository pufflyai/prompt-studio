import { Badge, Icon } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Circle } from "lucide-react";

export type BackendConnectionStatus = "connecting" | "connected" | "error";

const statusView = {
  connecting: {
    color: "fg.info",
    label: "Backend connecting",
    text: "Connecting",
  },
  connected: {
    color: "fg.success",
    label: "Backend connected",
    text: "Connected",
  },
  error: {
    color: "fg.error",
    label: "Backend disconnected",
    text: "Disconnected",
  },
} satisfies Record<BackendConnectionStatus, { color: string; label: string; text: string }>;

export const BackendConnectionStatusBadge = (props: { status: BackendConnectionStatus }) => {
  const { status } = props;
  const view = statusView[status];

  return (
    <Tooltip content={view.label}>
      <Badge
        alignItems="center"
        aria-label={view.label}
        colorPalette="gray"
        flexShrink={0}
        gap="2xs"
        h="1.25rem"
        maxW="full"
        minH="1.25rem"
        minW="0"
        px="2xs"
        role="status"
        textStyle="label/XS/medium"
        variant="surface"
        whiteSpace="nowrap"
      >
        <Icon as={Circle} boxSize="2" color={view.color} fill="currentColor" flexShrink={0} />
        {view.text}
      </Badge>
    </Tooltip>
  );
};
