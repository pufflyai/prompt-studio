import { Box, Button, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import { FileText, LoaderCircle, MessageCircle, Ticket } from "lucide-react";
import { useState } from "react";

export default { title: "Proposals/PS-215 Resource activity" };

const resources = [
  { id: "session", label: "Release conversation", icon: MessageCircle, tracked: true },
  { id: "note", label: "Release notes", icon: FileText, tracked: true },
  { id: "ticket", label: "Release checklist", icon: Ticket, tracked: false },
];
const ActivityDot = () => (
  <Tooltip content="New activity">
    <Box boxSize="1.5" bg="fg.info" borderRadius="full" flexShrink="0" role="img" aria-label="New activity" />
  </Tooltip>
);

export const SharedActivity = () => {
  const [active, setActive] = useState("session");
  const [versions, setVersions] = useState<Record<string, number>>({ session: 1, note: 1, ticket: 1 });
  const [seen, setSeen] = useState<Record<string, number>>({ session: 1, note: 1, ticket: 1 });
  const [running, setRunning] = useState(false);
  const unread = (id: string) =>
    id !== active && resources.find((item) => item.id === id)?.tracked && versions[id] > seen[id];
  const open = (id: string) => {
    setActive(id);
    setSeen((current) => ({ ...current, [id]: versions[id] }));
  };
  const change = (id: string) => {
    setVersions((current) => ({ ...current, [id]: current[id] + 1 }));
    if (id === active) setSeen((current) => ({ ...current, [id]: versions[id] + 1 }));
  };
  return (
    <Stack p="md" gap="md" w="3xl">
      <Text textStyle="heading.sm">Shared resource activity · proposed</Text>
      <HStack gap="sm" flexWrap="wrap">
        <Button onClick={() => change(active === "note" ? "session" : "note")}>Change inactive resource</Button>
        <Button onClick={() => change(active)}>Change visible resource</Button>
        <Button onClick={() => setRunning((value) => !value)}>Toggle execution status</Button>
      </HStack>
      <HStack align="stretch" gap="md">
        <Stack w="xs" flexShrink="0" borderWidth="1px" borderColor="border" borderRadius="md" p="sm">
          {resources.map(({ id, label, icon: Icon }) => (
            <ListRow
              key={id}
              id={id}
              label={label}
              icon={<Icon />}
              endContent={unread(id) ? <ActivityDot /> : undefined}
              isSelected={active === id}
              onClick={() => open(id)}
            />
          ))}
        </Stack>
        <Tabs.Root value={active} onValueChange={({ value }) => open(value)} flex="1" minW="0">
          <Tabs.List>
            {resources.map(({ id, label }) => (
              <Tabs.Trigger key={id} value={id}>
                {id === "session" && running ? <LoaderCircle aria-label="Running" /> : null}
                <Text>{label}</Text>
                {unread(id) ? <ActivityDot /> : null}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {resources.map(({ id, label, tracked }) => (
            <Tabs.Content key={id} value={id}>
              <Stack p="md">
                <Text>{label}</Text>
                <Text color="fg.muted">
                  {tracked
                    ? "Viewing acknowledges activity in every presentation."
                    : "This extension has not enabled activity tracking."}
                </Text>
              </Stack>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </HStack>
    </Stack>
  );
};
