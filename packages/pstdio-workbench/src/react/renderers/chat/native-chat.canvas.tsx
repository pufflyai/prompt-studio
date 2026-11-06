import { ChatPanel } from "@pstdio/ui/chat-ui";
import { NativeChatDraftRecovery } from "./native-chat-draft-recovery";

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
