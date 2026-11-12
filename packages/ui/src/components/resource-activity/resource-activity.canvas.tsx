import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Activity } from "../activity";
export default {
  title: "Components/Resource Activity",
  description: "One resource feed with discussion and revision-bound outcomes. Sessions retain their conversation.",
};
export const ResourceActivity = () => {
  const [session, setSession] = useState(false);
  const [resolved, setResolved] = useState(false);
  return (
    <Stack gap="md" p="md">
      <Button onClick={() => setSession(!session)}>{session ? "Open ticket" : "Open session"}</Button>
      <Text>{session ? "Session conversation" : "Ticket content"}</Text>
      {!session && (
        <Activity.Root>
          <Activity.Header />
          <Activity.Feed>
            <Activity.Comment
              actor={{ name: "Person" }}
              timestamp="12:00"
              actions={
                <Button variant="ghost" onClick={() => setResolved(!resolved)}>
                  {resolved ? "Reopen" : "Resolve"}
                </Button>
              }
            >
              Please check the implementation.
            </Activity.Comment>
            <Activity.Comment actor={{ name: "Implementer" }} timestamp="12:05">
              <Stack>
                <Text>Implementation · revision 1 · a1b2c3d</Text>
                <Text>Resource Activity persists comments and outcomes.</Text>
                <Text>bun test — passed</Text>
              </Stack>
            </Activity.Comment>
            <Activity.Comment actor={{ name: "Reviewer" }} timestamp="12:10">
              <Stack>
                <Text>Review · approved revision 1 · a1b2c3d</Text>
                <Text>No unresolved findings.</Text>
              </Stack>
            </Activity.Comment>
          </Activity.Feed>
          <Activity.Composer variant="compact" />
        </Activity.Root>
      )}
    </Stack>
  );
};
