import { Button, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState } from "@pstdio/ui";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import { useState } from "react";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { NativeChatDraftRecovery } from "./native-chat-draft-recovery";
import type { NativeChatHostProps } from "./native-chat-host";
import { NativeChatView } from "./native-chat-view";

export default { title: "Renderers/Native chat", fullscreen: true };
const composer = {
  emptyStateTitle: "No messages yet",
  emptyStateDescription: "Send a message to start this session.",
  chatInputPlaceholder: "Reply to the agent...",
};
export const FirstOpen = () => <ChatPanel {...composer} messages={[]} chatInputDefaultValue="Unsent draft" />;
export const DelayedTranscript = () => (
  <ChatPanel {...composer} messages={[]} loading chatInputDefaultValue="Typing while history loads" />
);
export const Streaming = () => (
  <ChatPanel
    {...composer}
    streaming
    messages={[{ id: "assistant", role: "assistant", parts: [{ type: "text", text: "Working on your request." }] }]}
  />
);
export const OtherDevice = () => (
  <ChatPanel
    {...composer}
    inputDisabled
    readOnlyQueue
    messages={[{ id: "history", role: "assistant", parts: [{ type: "text", text: "History from another device." }] }]}
  />
);
export const RecoveredDraft = () => (
  <ChatPanel
    {...composer}
    messages={[]}
    chatInputDefaultValue="New typing"
    conversationNotices={
      <NativeChatDraftRecovery
        recovered={[{ text: "Earlier saved work", attachments: [{ id: "file", name: "notes.txt" }], values: {} }]}
        onRestore={() => undefined}
      />
    }
  />
);

// Synthetic trusted-host states; no account or session service is contacted by these frames.
type AccountPreviewState = "signed-out" | "checking" | "error" | "history" | "fork" | "fork-failure" | "read-only";
const PreviewAccountSetup = ({ state }: { state: AccountPreviewState }) => {
  if (state === "checking") return null;
  if (state === "error")
    return (
      <AlertMessage
        role="alert"
        status="error"
        title="Could not check harness authentication."
        endElement={<Button>Retry</Button>}
      />
    );
  return (
    <EmptyState
      title="Sign in to Claude Code"
      description="Sign in to send messages. You can also use /login in the chat."
    >
      <Button>Sign in</Button>
    </EmptyState>
  );
};
const NativeAccountPreview = (props: { state: AccountPreviewState }) => {
  const [forkedId, setForkedId] = useState("");
  const forkable = props.state === "fork" || props.state === "fork-failure" || props.state === "read-only";
  const [session] = useState(() =>
    createChatSession({
      initial: {
        messages:
          props.state === "history" || forkable
            ? [{ id: "completed-reply", role: "assistant", parts: [{ type: "text", text: "Earlier completed reply" }] }]
            : [],
        readOnly: props.state === "read-only",
        fork: forkable ? { disabledReason: null } : undefined,
      },
      query: async () => ({}),
      action: async (action) => {
        if (action.type === "fork") {
          if (props.state === "fork-failure") throw new Error("This harness does not support forking conversations.");
          setForkedId(action.messageId);
        }
        return {};
      },
    }),
  );
  const Host = ({ children }: NativeChatHostProps) =>
    children({
      account: {
        blocked: !forkable,
        commands: [],
        assertReady() {},
        isCommand: () => false,
        submit: () => undefined,
        progress: null,
        notice: null,
        setup: forkable || props.state === "checking" ? undefined : <PreviewAccountSetup state={props.state} />,
      },
    });
  return (
    <>
      <NativeChatView session={session} conversationKey={props.state} action={undefined} Host={Host} />
      <Text data-testid="forked-message">{forkedId}</Text>
    </>
  );
};
export const SignInRequired = () => <NativeAccountPreview state="signed-out" />;
export const AuthenticationChecking = () => <NativeAccountPreview state="checking" />;
export const AuthenticationFailure = () => <NativeAccountPreview state="error" />;
export const SignedOutHistory = () => <NativeAccountPreview state="history" />;
export const ForkableReply = () => <NativeAccountPreview state="fork" />;
export const ForkFailure = () => <NativeAccountPreview state="fork-failure" />;
export const ReadOnlyFork = () => <NativeAccountPreview state="read-only" />;

export const ConversationFailure = () => {
  const [session] = useState(() => {
    let attempts = 0;
    return createChatSession({
      initial: {
        messages: [{ id: "saved", role: "assistant", parts: [{ type: "text", text: "Earlier saved reply." }] }],
      },
      query: async () => {
        if (attempts++ === 0) throw new Error("The conversation connection was lost. Retry to reconnect.");
        return {};
      },
      action: async () => ({}),
    });
  });
  return <NativeChatView session={session} conversationKey="connection-failure" action={undefined} />;
};
