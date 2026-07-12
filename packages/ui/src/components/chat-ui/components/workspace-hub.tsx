import { Flex, HStack, Spinner, Text } from "@chakra-ui/react";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { DiffBubble } from "@/components/diff-viewer/diff-bubble";

type WorkspaceHubStatus = "ready" | "loading" | "error";

interface ChatWorkspaceHubProps {
  changesLabel: string;
  additions: number;
  deletions: number;
  action?: ReactNode;
  status?: WorkspaceHubStatus;
  statusLabel?: string;
}

export const ChatWorkspaceHub = (props: ChatWorkspaceHubProps) => {
  const { changesLabel, additions, deletions, action, status = "ready", statusLabel } = props;
  const hasChanges = additions > 0 || deletions > 0;

  return (
    <Flex align="center" justify="space-between" gap="sm" minW="0" px="xs" pb="2xs">
      {status === "loading" ? (
        <HStack gap="xs" minW="0">
          <Spinner size="xs" color="fg.muted" />
          <Text textStyle="label/S/regular" color="fg.muted" truncate>
            {statusLabel ?? "Setting up workspace..."}
          </Text>
        </HStack>
      ) : status === "error" ? (
        <HStack gap="xs" minW="0">
          <AlertTriangle size={14} color="var(--chakra-colors-fg-error)" />
          <Text textStyle="label/S/regular" color="fg.error" truncate>
            {statusLabel ?? "Workspace setup failed"}
          </Text>
        </HStack>
      ) : hasChanges ? (
        <DiffBubble
          label={changesLabel}
          additions={additions}
          deletions={deletions}
          variant="ghost"
          size="small"
          _hover={{ background: "transparent" }}
        />
      ) : (
        <Flex flex="1" />
      )}
      {action ? (
        <Flex flexShrink={0} ml="auto">
          {action}
        </Flex>
      ) : null}
    </Flex>
  );
};
