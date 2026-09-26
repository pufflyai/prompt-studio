import { Button, Dialog, Flex, Portal, Stack, Text } from "@chakra-ui/react";
import type { SessionConversationSources, SessionHistoryIssue } from "@pstdio/sdk/api";
import { AlertMessage } from "@pstdio/ui";
import type { RendererReadRegistry } from "@pstdio/workbench";
import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";

interface SessionHistoryNoticeProps {
  sessionId: string;
  ownerKey: string;
  reads: RendererReadRegistry;
  issue?: SessionHistoryIssue;
  error?: string;
  retry(): void;
  loadSources?: (sessionId: string, signal: AbortSignal) => Promise<SessionConversationSources>;
}
const loadConversationSources = (id: string, signal: AbortSignal) =>
  getApiClient().sessions.getConversationSources(id, signal);
const downloadSource = (name: string, messages: NonNullable<SessionConversationSources["checkpoint"]>) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(messages, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const SessionHistoryNotice = (props: SessionHistoryNoticeProps) => {
  const { sessionId, ownerKey, reads, issue, error, retry, loadSources = loadConversationSources } = props;
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sources, setSources] = useState<SessionConversationSources>();
  const [sourceError, setSourceError] = useState<string>();
  useEffect(() => {
    if (!open) return;
    const binding = reads.bind(`${ownerKey}:history-sources`);
    setSources(undefined);
    setSourceError(undefined);
    binding.request({
      queryKey: JSON.stringify([sessionId, attempt]),
      load: (signal) => loadSources(sessionId, signal),
      onValue: setSources,
      onError: (error) => setSourceError(error instanceof Error ? error.message : String(error)),
    });
    return () => binding.dispose();
  }, [sessionId, ownerKey, reads, open, attempt, loadSources]);
  const unavailable = issue?.code === "native_unavailable";
  const title = unavailable ? "Some history could not be checked" : "Conversation history needs review";
  return (
    <>
      <AlertMessage
        status="warning"
        title={title}
        endElement={
          <Flex gap="xs">
            <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
              History sources
            </Button>
            <Button size="xs" variant="ghost" onClick={retry}>
              Retry
            </Button>
          </Flex>
        }
      >
        {error ??
          (unavailable
            ? "Showing the saved conversation. The agent history is unavailable."
            : "The saved and agent histories could not be safely combined. Review both sources before resuming.")}
      </AlertMessage>
      <Dialog.Root open={open} onOpenChange={(event) => setOpen(event.open)} size="lg">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Conversation history sources</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="md">
                  <Text>
                    Download the available histories to compare them. Reviewing sources does not change the
                    conversation.
                  </Text>
                  {!sources && !sourceError ? <Text>Loading history sources…</Text> : null}
                  {sourceError ? (
                    <AlertMessage
                      status="error"
                      title="Could not load sources"
                      endElement={
                        <Button size="xs" onClick={() => setAttempt((value) => value + 1)}>
                          Retry
                        </Button>
                      }
                    >
                      {sourceError}
                    </AlertMessage>
                  ) : null}
                  {sources
                    ? (["checkpoint", "native"] as const).map((source) => {
                        const messages = sources[source];
                        return (
                          <Flex key={source} gap="sm" align="center" justify="space-between">
                            <Stack gap="xs">
                              <Text>{source === "checkpoint" ? "Saved conversation" : "Agent history"}</Text>
                              <Text color="fg.muted">{messages ? `${messages.length} messages` : "Unavailable"}</Text>
                            </Stack>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!messages}
                              onClick={() => messages && downloadSource(`${sessionId}-${source}.json`, messages)}
                            >
                              Download
                            </Button>
                          </Flex>
                        );
                      })
                    : null}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.CloseTrigger asChild>
                  <Button variant="outline">Close</Button>
                </Dialog.CloseTrigger>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
};
