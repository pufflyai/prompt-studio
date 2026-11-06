import { Button, Flex, Text } from "@chakra-ui/react";
import type { ChatDraft } from "@pstdio/sdk/extensions";

export const NativeChatDraftRecovery = (props: {
  recovered?: ChatDraft["recovered"];
  onRestore(index: number): void;
  hidden?(draft: NonNullable<ChatDraft["recovered"]>[number]): boolean;
}) => (
  <Flex direction="column" gap="xs">
    {props.recovered?.map((draft, index) =>
      props.hidden?.(draft) ? null : (
        <Flex key={index} direction="column" gap="xs">
          <Text>A saved draft arrived while you were typing. Both drafts are kept.</Text>
          <Text>{draft.text}</Text>
          {draft.attachments.map((file) => (
            <Text key={file.id}>{file.name}</Text>
          ))}
          <Button size="xs" variant="ghost" onClick={() => props.onRestore(index)}>
            Restore saved draft
          </Button>
        </Flex>
      ),
    )}
  </Flex>
);
