import { Badge, Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { Blocks } from "lucide-react";
import { useState } from "react";
import { ListRow } from "../../components/list-row/list-row";
import { ScrollArea } from "../../components/primitives/scroll-area";

export default {
  title: "Proposals/PS-1260 Public and personal extensions",
  fullscreen: true,
  description:
    "Filter public extensions and your extensions. Ownership and visibility are independent: a published extension can be both Public and Mine. Synthetic metadata only; scope never determines privacy.",
};

const examples = [
  {
    id: "planner",
    name: "Project Planner",
    publisher: "Prompt Studio",
    mine: false,
    visibility: "Public",
    scope: "All projects",
  },
  {
    id: "health",
    name: "Release health",
    publisher: "You",
    mine: true,
    visibility: "Not published",
    scope: "This project",
  },
  { id: "notes", name: "My team notes", publisher: "You", mine: true, visibility: "Public", scope: "All projects" },
  {
    id: "legacy",
    name: "Imported helper",
    publisher: "Unknown",
    mine: undefined,
    visibility: "Visibility unknown",
    scope: "This project",
  },
];

export const ExtensionOwnership = () => {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const visible = examples.filter(
    (item) =>
      (filter === "All" ||
        (filter === "Public" && item.visibility === "Public") ||
        (filter === "Mine" && item.mine === true)) &&
      item.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const detail = examples.find((item) => item.id === selected);
  return (
    <Stack h="full" minH="0" gap="0" bg="bg" color="fg">
      <Stack p="lg" gap="md" borderBottomWidth="1px" borderColor="border">
        <Text textStyle="heading/M">Extensions</Text>
        <HStack gap="sm" flexWrap="wrap">
          {["All", "Public", "Mine"].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "solid" : "ghost"}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setSelected(undefined);
              }}
            >
              {value}
            </Button>
          ))}
          <Input
            flex="1"
            minW="0"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search extensions…"
            aria-label="Search extensions"
          />
        </HStack>
      </Stack>
      <ScrollArea flex="1" minH="0">
        <Stack p="md" gap="sm">
          {visible.map((item) => (
            <Stack key={item.id} gap="0" borderBottomWidth="1px" borderColor="border.subtle">
              <ListRow
                id={item.id}
                label={item.name}
                icon={<Blocks />}
                isSelected={selected === item.id}
                onClick={() => setSelected(item.id)}
                endContent={
                  <HStack gap="xs">
                    <Badge>{item.visibility}</Badge>
                    {item.mine && <Badge>Mine</Badge>}
                  </HStack>
                }
              />
              <Text px="sm" pb="sm" textStyle="label/XS" color="fg.muted">
                {item.publisher} · {item.scope}
              </Text>
            </Stack>
          ))}
          {!visible.length && <Text color="fg.muted">No matching extensions</Text>}
          {detail && (
            <Box borderWidth="1px" borderColor="border" borderRadius="md" p="md">
              <Stack gap="sm">
                <Text textStyle="heading/S">{detail.name}</Text>
                <Text>Visibility: {detail.visibility}</Text>
                <Text>Owner: {detail.publisher}</Text>
                <Text>Installed for: {detail.scope}</Text>
                {detail.visibility === "Visibility unknown" && (
                  <Text color="fg.muted">Visibility has not been verified.</Text>
                )}
                <Button alignSelf="start" variant="ghost" onClick={() => setSelected(undefined)}>
                  Close details
                </Button>
              </Stack>
            </Box>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};
