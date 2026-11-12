import { Button, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Activity } from "../activity";
export default {
  title: "Components/Resource Activity",
  description: "Document-width discussion, subtle retrieval feedback and compact change events.",
};
export const ResourceActivity = () => {
  const [session, setSession] = useState(false);
  const [error, setError] = useState(false);
  const [attached, setAttached] = useState(false);
  const [body, setBody] = useState("");
  const [comments, setComments] = useState(["Please check the implementation."]);
  return (
    <Stack layerStyle="markdownEditorInset" gap="md">
      <HStack>
        <Button onClick={() => setSession(!session)}>{session ? "Open ticket" : "Open session"}</Button>
        <Button onClick={() => setError(!error)}>Toggle retrieval error</Button>
      </HStack>
      <Stack layerStyle="documentContent" gap="lg">
        <Text>{session ? "Session conversation" : "Ticket content"}</Text>
        {!session && (
          <Activity.Root>
            <Separator />
            <Activity.Header />
            {error && (
              <HStack layerStyle="resourceActivityNotice" role="status">
                <Text flex="1">Cannot retrieve Activity.</Text>
                <Button variant="ghost" size="xs" onClick={() => setError(false)}>
                  Retry
                </Button>
              </HStack>
            )}
            <Activity.Feed>
              <Activity.Timeline>
                <Activity.Event actor={{ name: "Aurelien" }} timestamp="2 min ago">
                  changed status to Blocked
                </Activity.Event>
              </Activity.Timeline>
              {comments.map((comment, index) => (
                <Activity.Comment key={index} actor={{ name: "Aurelien" }} timestamp="2 min ago" tone="sent">
                  {comment}
                </Activity.Comment>
              ))}
            </Activity.Feed>
            <Activity.Composer
              variant="compact"
              hasAttachments={attached}
              onAttach={() => setAttached(true)}
              attachmentList={
                attached && (
                  <Button variant="ghost" size="xs" onClick={() => setAttached(false)}>
                    trace.log ×
                  </Button>
                )
              }
              value={body}
              onChange={setBody}
              onSubmit={(text) => {
                setComments([...comments, text || "trace.log"]);
                setBody("");
                setAttached(false);
              }}
            />
          </Activity.Root>
        )}
      </Stack>
    </Stack>
  );
};
