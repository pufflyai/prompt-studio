import { Box, Button, Flex, Text } from "@chakra-ui/react";
import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { ActionErrorSlot, AlertMessage, UnresolvedSubmission } from "@pstdio/ui";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import type { NativeChatHostServices } from "./native-chat-host";

interface NativeChatNoticesProps {
  host: NativeChatHostServices;
  state: ReturnType<ChatSession["getSnapshot"]>;
  session: ChatSession;
}
export const NativeChatNotices = ({ host, state }: Omit<NativeChatNoticesProps, "session">) => {
  const { notice } = state.conversation;
  return (
    <>
      {host.account?.notice}
      {(host.messages ?? state.messages).length > 0 ? (host.account?.setup ?? host.account?.progress) : null}
      {host.linkNotice}
      {notice ? <Text>{notice}</Text> : null}
    </>
  );
};

export const NativeChatErrors = ({ state, session }: Omit<NativeChatNoticesProps, "host">) => {
  const failures = state.pending?.filter(
    (item) => item.failure && !item.failureDismissed && (!item.unresolved || item.unresolved.recovery.isRetained()),
  );
  if (!state.error && !failures?.length) return null;
  return (
    <Box position="relative" h="0">
      <ActionErrorSlot edge="above">
        {failures?.map((item) =>
          item.unresolved ? (
            <UnresolvedSubmission
              key={item.message.id}
              submission={item.unresolved}
              onInspect={session.inspectResources}
              onClose={() => session.dismissSubmission(item.message.id)}
              onDiscard={() => session.discardUnresolvedSubmission(item.message.id)}
            />
          ) : (
            <AlertMessage
              key={item.message.id}
              compact
              status="error"
              title="Message not sent"
              onClose={() => session.dismissSubmission(item.message.id)}
            >
              {item.failure}
            </AlertMessage>
          ),
        )}
        {state.error ? (
          <AlertMessage
            role="alert"
            status="error"
            title={state.canRefreshError ? "Could not refresh conversation" : "Conversation action failed"}
            onClose={session.dismissError}
            endElement={state.canRefreshError ? <Button onClick={session.reconnect}>Retry</Button> : undefined}
          >
            {state.error}
          </AlertMessage>
        ) : null}
      </ActionErrorSlot>
    </Box>
  );
};
export const NativeChatComposerHeader = (props: Omit<NativeChatNoticesProps, "host">) => (
  <NativeChatErrors state={props.state} session={props.session} />
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
