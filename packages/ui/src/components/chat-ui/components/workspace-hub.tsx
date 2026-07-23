import { Flex, HStack, Spinner, Text } from "@chakra-ui/react";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

type WorkspaceHubStatus = "ready" | "loading" | "error";

interface ChatWorkspaceHubProps {
  /** Workspace identity/selector shown at the start of the header (e.g. GitBranch + name). */
  workspaceControl?: ReactNode;
  additions: number;
  deletions: number;
  /** Icon-only action that opens the workspace resource. */
  action?: ReactNode;
  status?: WorkspaceHubStatus;
  statusLabel?: string;
}

const HubStatus = (props: {
  status: WorkspaceHubStatus;
  statusLabel?: string;
  additions: number;
  deletions: number;
}) => {
  const { status, statusLabel, additions, deletions } = props;

  if (status === "loading") {
    return (
      <HStack gap="2xs" minW="0">
        <Spinner size="xs" color="fg.muted" />
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {statusLabel ?? "Setting up workspace..."}
        </Text>
      </HStack>
    );
  }

  if (status === "error") {
    return (
      <HStack gap="2xs" minW="0">
        <AlertTriangle size={14} color="var(--chakra-colors-fg-error)" />
        <Text textStyle="label/XS/regular" color="fg.error" truncate>
          {statusLabel ?? "Workspace setup failed"}
        </Text>
      </HStack>
    );
  }

  // Ready: the diff counts take the slot, and only when there is something to show.
  if (additions <= 0 && deletions <= 0) return null;

  return (
    <HStack gap="2xs">
      <Text textStyle="label/XS/medium" color="fg.success">
        +{additions}
      </Text>
      <Text textStyle="label/XS/medium" color="fg.error">
        −{deletions}
      </Text>
    </HStack>
  );
};

/**
 * Workspace hub header: the frame the session sits in. The identity is always present;
 * the slot beside it carries the diff counts, or the setup status while the workspace is
 * being created or has failed. The open action recedes during setup.
 */
export const ChatWorkspaceHub = (props: ChatWorkspaceHubProps) => {
  const { workspaceControl, additions, deletions, action, status = "ready", statusLabel } = props;

  return (
    <Flex align="center" justify="space-between" gap="sm" minW="0" pl="xs" pr="2xs" py="2xs">
      <HStack gap="sm" minW="0">
        {workspaceControl}
        <HubStatus status={status} statusLabel={statusLabel} additions={additions} deletions={deletions} />
      </HStack>
      {action ? <Flex flexShrink={0}>{action}</Flex> : null}
    </Flex>
  );
};
