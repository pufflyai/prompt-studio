import { Button, Flex, Text } from "@chakra-ui/react";
import type { ChatDraft, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import { NativeChatDraftRecovery } from "./native-chat-draft-recovery";
import type { NativeChatHostServices } from "./native-chat-host";

interface NativeChatNoticesProps {
  host: NativeChatHostServices;
  notice?: string;
  error?: string;
  draft: ChatDraft;
  session: ChatSession;
}
export const NativeChatNotices = ({ host, notice, error, draft, session }: NativeChatNoticesProps) => (
  <>
    {host.account?.progress}
    {host.account?.notice}
    {host.linkNotice}
    <NativeChatDraftRecovery recovered={draft.recovered} onRestore={session.restoreDraft} />
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
