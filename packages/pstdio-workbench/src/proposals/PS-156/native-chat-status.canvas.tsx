import { Button, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import { useState } from "react";

export default { title: "Proposals/PS-156 Chat error alerts", fullscreen: true };

export const Failures = () => {
  const [authentication, setAuthentication] = useState(false);
  const [retried, setRetried] = useState(false);
  return (
    <Stack h="full" minH="0">
      <Button
        onClick={() => {
          setAuthentication(!authentication);
          setRetried(false);
        }}
      >
        {authentication ? "Show conversation error" : "Show authentication error"}
      </Button>
      <Text role="status">{retried ? "Retry requested" : ""}</Text>
      <ChatPanel
        messages={[{ id: "saved", role: "assistant", parts: [{ type: "text", text: "Earlier saved reply." }] }]}
        conversationNotices={
          <AlertMessage
            role="alert"
            status="error"
            title={authentication ? "Could not check harness authentication." : "Connection lost."}
            endElement={<Button onClick={() => setRetried(true)}>Retry</Button>}
          />
        }
      />
    </Stack>
  );
};
