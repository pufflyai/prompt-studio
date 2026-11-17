import { Box, Stack, Text } from "@chakra-ui/react";
import { Circle, MessageCircle } from "lucide-react";
import { useState } from "react";
import { TreeList } from "../tree-list/tree-list";

export default { title: "Design system/Patterns/Tabs/Linked resources" };
export const Relationships = () => {
  const [resource, setResource] = useState("ticket");
  const node = (id: string, label: string) => ({ id, label, icon: id === "session" ? <MessageCircle /> : <Circle /> });
  return (
    <Stack>
      <Text>{resource === "session" ? "Review the release" : "PS-204 · Keep work easy to reach"}</Text>
      <Box w="xs">
        <TreeList
          sections={
            resource === "session"
              ? [
                  { id: "tickets", label: "Tickets", nodes: [node("ticket", "PS-204 · Keep work easy to reach")] },
                  { id: "pinned", label: "Pinned", nodes: [node("session", "Review the release")] },
                  { id: "sessions", label: "Sessions", nodes: [node("another-session", "Plan the next release")] },
                ]
              : [
                  { id: "parent", label: "Parent", nodes: [node("parent", "PS-200 · Improve navigation")] },
                  {
                    id: "depends-on",
                    label: "Depends on",
                    nodes: [node("dependency", "PS-201 · Shared resource links")],
                  },
                  { id: "sessions", label: "Sessions", nodes: [node("session", "Review the release")] },
                ]
          }
          onNavigate={(node) => setResource(node.nodeId)}
        />
      </Box>
    </Stack>
  );
};
