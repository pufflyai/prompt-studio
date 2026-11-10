import { Stack, Text } from "@chakra-ui/react";
import { Button, ResourceActionMenu } from "@pstdio/ui";
import { useState } from "react";

export default {
  title: "Product/Sessions/Session actions",
  description: "Copy a saved session reference to share with another agent.",
};

export const CopySessionId = () => {
  const [copied, setCopied] = useState("");
  const sessionId = "019a6810-f835-7000-8000-000000000001";
  return (
    <Stack p="md" gap="md">
      <ResourceActionMenu
        actions={[
          { key: "copy", label: "Copy session ID", onClick: () => setCopied(sessionId) },
          { key: "rename", label: "Rename session", onClick: () => {} },
          { key: "archive", label: "Archive session", onClick: () => {} },
          { key: "delete", label: "Delete session", onClick: () => {}, separatorBefore: true },
        ]}
      >
        <Button variant="ghost">Failed session</Button>
      </ResourceActionMenu>
      {copied && <Text>Session ID copied: {copied}</Text>}
    </Stack>
  );
};
