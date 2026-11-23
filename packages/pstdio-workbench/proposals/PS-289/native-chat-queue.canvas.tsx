import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ChatPanel, type QueuedFollowUp } from "@pstdio/ui/chat-ui";
import { useState } from "react";

const first = { id: "first", prompt: "Run the focused tests." };
const second = { id: "second", prompt: "Check the dashboard, too." };

export default { title: "Proposals/PS-289 Queue changes" };

export const QueueChangeFeedback = () => {
  const [confirmed, setConfirmed] = useState<QueuedFollowUp[]>([first, second]);
  const [pending, setPending] = useState<QueuedFollowUp[]>();
  const [unconfirmed, setUnconfirmed] = useState(false);
  return (
    <Stack width="40rem" height="32rem" gap="xs">
      <HStack>
        <Button
          size="xs"
          disabled={!pending}
          onClick={() => {
            if (pending) setConfirmed(pending);
            setPending(undefined);
          }}
        >
          Confirm change
        </Button>
        <Button
          size="xs"
          disabled={!pending}
          onClick={() => {
            setPending(undefined);
            setUnconfirmed(true);
          }}
        >
          Lose response
        </Button>
        <Button size="xs" disabled={!unconfirmed} onClick={() => setUnconfirmed(false)}>
          Discard attempt
        </Button>
      </HStack>
      <ChatPanel
        messages={[{ id: "user", role: "user", parts: [{ type: "text", text: "Check this branch." }] }]}
        streaming
        chatInputDefaultValue="Look at the diff after the tests."
        chatInputPlaceholder="Reply to the agent..."
        emptyStateDescription="Start a conversation."
        emptyStateTitle="No messages"
        queuedFollowUps={pending ?? confirmed}
        readOnlyQueue={Boolean(pending || unconfirmed)}
        composerHeader={
          pending || unconfirmed ? (
            <Text role="status" textStyle="label/XS" color="fg.muted">
              {unconfirmed ? "Queue change could not be confirmed. See System activity." : "Updating the queue…"}
            </Text>
          ) : undefined
        }
        onQueuedFollowUpRemove={(id) => setPending(confirmed.filter((item) => item.id !== id))}
        onQueuedFollowUpMove={(id, direction) => {
          const index = confirmed.findIndex((item) => item.id === id);
          const destination = index + (direction === "up" ? -1 : 1);
          if (index < 0 || destination < 0 || destination >= confirmed.length) return;
          const next = [...confirmed];
          const [item] = next.splice(index, 1);
          next.splice(destination, 0, item);
          setPending(next);
        }}
      />
    </Stack>
  );
};
