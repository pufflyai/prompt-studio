import { Button, Flex, Text } from "@chakra-ui/react";
import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { AlertMessage } from "@pstdio/ui";
import { chatDraftContentKey } from "../../../extensions/contributions/chat-draft-recovery";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import { NativeChatDraftRecovery } from "./native-chat-draft-recovery";
import type { NativeChatHostServices } from "./native-chat-host";

interface NativeChatNoticesProps {
  host: NativeChatHostServices;
  state: ReturnType<ChatSession["getSnapshot"]>;
  session: ChatSession;
}
export const NativeChatNotices = ({ host, state, session }: NativeChatNoticesProps) => {
  const {
    draft,
    error,
    pending,
    conversation: { notice },
  } = state;
  return (
    <>
      {host.account?.progress}
      {host.account?.notice}
      {host.linkNotice}
      <NativeChatDraftRecovery
        recovered={draft.recovered}
        hidden={(saved) =>
          Boolean(pending?.some((item) => item.failure && chatDraftContentKey(item) === chatDraftContentKey(saved)))
        }
        onRestore={session.restoreDraft}
      />
      {pending
        ?.filter((item) => item.failure)
        .map((item) => (
          <AlertMessage
            key={item.message.id}
            status="error"
            title="Message not sent"
            onClose={() => session.restoreSubmission(item.message.id)}
          >
            {item.failure}
          </AlertMessage>
        ))}
      {notice ? <Text>{notice}</Text> : null}
      {error ? (
        <Flex direction="column" gap="xs">
          <Text role="alert">{error}</Text>
          <Button size="xs" variant="ghost" onClick={session.reconnect}>
            Retry
          </Button>
        </Flex>
      ) : null}
    </>
  );
};
interface NativeChatResourcesProps {
  resources: ChatRendererSnapshot["resources"];
  run: ChatSession["run"];
}
export const NativeChatResources = ({ resources, run }: NativeChatResourcesProps) =>
  resources?.length ? (
    <Flex gap="xs">
      {resources.map((resource) => (
        <Button
          key={resource.id}
          variant="ghost"
          size="xs"
          onClick={() => void run({ type: "openResource", id: resource.id }).catch(() => undefined)}
        >
          {resource.label}
          {resource.additions === undefined ? null : <Text color="fg.success">+{resource.additions}</Text>}
          {resource.deletions === undefined ? null : <Text color="fg.error">−{resource.deletions}</Text>}
        </Button>
      ))}
    </Flex>
  ) : null;
