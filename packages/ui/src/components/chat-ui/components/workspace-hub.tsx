import { Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { DiffBubble } from "@/components/diff-bubble";

interface ChatWorkspaceHubProps {
  changesLabel: string;
  additions: number;
  deletions: number;
  action?: ReactNode;
}

export const ChatWorkspaceHub = (props: ChatWorkspaceHubProps) => {
  const { changesLabel, additions, deletions, action } = props;

  return (
    <Flex
      align="center"
      justify="space-between"
      gap="sm"
      minW="0"
      px="sm"
      py="xs"
      borderWidth="1px"
      borderColor="border.muted"
      borderRadius="xs"
      borderBottomRadius="0"
      bg="bg.subtle"
    >
      <DiffBubble
        label={changesLabel}
        additions={additions}
        deletions={deletions}
        variant="ghost"
        size="small"
        _hover={{ background: "transparent" }}
      />
      {action}
    </Flex>
  );
};
