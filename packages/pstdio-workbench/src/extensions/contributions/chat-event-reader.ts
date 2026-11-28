import type { ChatDraft, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { applySessionMessagePatch } from "@pstdio/ui/chat-ui";
import { createChatStreamReader } from "./chat-stream-reader";

export const createChatEventReader = (input: {
  reserve: () => number;
  messages: () => NonNullable<ChatRendererSnapshot["messages"]>;
  merge: (snapshot: ChatRendererSnapshot, issued: number) => void;
  recover: (draft: ChatDraft) => void;
}) => {
  let revision = -1;
  let hasMessages = false;
  const reader = createChatStreamReader({
    reserve: input.reserve,
    accept: (event, issued) => {
      if (event.revision <= revision) return;
      if ("patch" in event && !hasMessages)
        throw new Error("A chat stream must send its transcript snapshot before incremental message patches.");
      revision = event.revision;
      if ("recoverDraft" in event) input.recover(event.recoverDraft);
      else if ("snapshot" in event) {
        if (event.snapshot.messages) hasMessages = true;
        input.merge(event.snapshot, issued);
      } else input.merge({ messages: applySessionMessagePatch(input.messages(), event.patch) }, issued);
    },
  });
  return {
    ...reader,
    restart: () => {
      revision = -1;
      hasMessages = false;
      reader.reset();
    },
  };
};
