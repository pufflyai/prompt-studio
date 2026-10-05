import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { WorkspaceBadge } from "@pstdio/ui";
import { ChatInput, ChatWorkspaceHub, createSerializedPromptState } from "@pstdio/ui/chat-ui";
import { ArrowUpRight, ChevronDown, GitBranch, Plus } from "lucide-react";
import type { ReactNode } from "react";

// The chat's workspace container while a turn runs: activity beside the name, diff on the right.
export const WorkspaceContainer = (props: { surface: ReactNode; elapsed: ReactNode }) => {
  const { surface, elapsed } = props;
  return (
    <Stack
      position="relative"
      isolation="isolate"
      gap="2xs"
      p="2xs"
      borderWidth="1px"
      borderColor="border"
      borderRadius="sm"
      bg="bg.subtle"
    >
      {surface}
      <ChatWorkspaceHub
        additions={0}
        deletions={0}
        workspaceControl={
          <HStack gap="sm" minW="0">
            <HStack gap="xs">
              <GitBranch size={14} />
              <Text textStyle="label/XS/regular">motion-studies</Text>
            </HStack>
            <HStack gap="2xs" color="fg.muted">
              <Spinner size="xs" color="fg.muted" />
              <Text textStyle="label/XS/regular" fontFamily="mono" fontVariantNumeric="tabular-nums">
                {elapsed}s
              </Text>
            </HStack>
          </HStack>
        }
        action={
          <HStack gap="sm">
            <HStack gap="2xs">
              <Text textStyle="label/XS/medium" color="fg.success">
                +24
              </Text>
              <Text textStyle="label/XS/medium" color="fg.error">
                −3
              </Text>
            </HStack>
            <ArrowUpRight size={14} />
          </HStack>
        }
      />
      <ChatInput
        defaultState={createSerializedPromptState("")}
        placeholder="Ask a follow-up…"
        streaming
        onInterrupt={() => {}}
        autoFocus={false}
        recessed
        actions={
          <HStack gap="xs" color="fg.muted">
            <Plus size={14} />
            <Text textStyle="label/XS/regular">Codex</Text>
            <ChevronDown size={12} />
          </HStack>
        }
      />
    </Stack>
  );
};

// Mirrors the board card from @pstdio/ui/kanban-renderer for a ticket with a linked session.
export const TicketCard = (props: { id: string; title: string; surface?: ReactNode; active?: boolean }) => {
  const { id, title, surface, active = false } = props;
  return (
    <Stack
      position="relative"
      isolation="isolate"
      gap="xs"
      padding="compact"
      borderRadius="compact"
      borderWidth="1px"
      borderColor="border"
      bg="bg"
    >
      {surface}
      <HStack minW="0" gap="2xs">
        <Text textStyle="label/XS" color="fg.muted" fontFamily="mono">
          {id}
        </Text>
        <HStack marginLeft="auto">
          <WorkspaceBadge
            workspaceType="worktree"
            label="motion-studies"
            sessionStatus={active ? "in_progress" : "completed"}
          />
        </HStack>
      </HStack>
      <Text textStyle="paragraph/S/regular">{title}</Text>
    </Stack>
  );
};
