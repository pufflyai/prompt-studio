import { Button, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { canvases } from "../canvases/definitions";
import type { commands } from "../commands";

export const CanvasCatalog = (props: { host: GuestHost }) => {
  const { host } = props;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [error, setError] = useState("");
  const groups = [...new Set(canvases.map((canvas) => canvas.group ?? "Designs"))];
  const needle = query.toLowerCase();
  const referenceCount = canvases.filter((canvas) =>
    canvas.items.some((item) => item.preview?.kind === "design"),
  ).length;
  const filtered = canvases.filter(
    (canvas) =>
      (!group || (canvas.group ?? "Designs") === group) &&
      (!needle ||
        `${canvas.id} ${canvas.name} ${canvas.group} ${canvas.keywords ?? ""} ${canvas.items.map((item) => `${item.id} ${item.name} ${item.preview?.source ?? ""}`).join(" ")}`
          .toLowerCase()
          .includes(needle)),
  );
  const open = async (id: string) => {
    try {
      await createWebviewClient<typeof commands>(host).commands.open({ canvas: id });
    } catch (error) {
      setError(String(error));
    }
  };
  return (
    <Stack h="full" minH="0" gap="0">
      <Stack p="md" gap="sm">
        <Flex align="center" justify="space-between">
          <Text textStyle="heading/M">UI Canvas</Text>
          <Text textStyle="label/S/medium" color="fg.muted">
            {canvases.reduce((count, canvas) => count + canvas.items.length, 0) - referenceCount} live previews ·{" "}
            {referenceCount} design references
          </Text>
        </Flex>
        <Input
          aria-label="Search UI Canvas"
          placeholder="Find a design, component, or state"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Flex wrap="wrap" gap="xs">
          <Button size="xs" variant={!group ? "subtle" : "ghost"} onClick={() => setGroup("")}>
            All
          </Button>
          {groups.map((entry) => (
            <Button
              key={entry}
              size="xs"
              variant={group === entry ? "subtle" : "ghost"}
              onClick={() => setGroup(entry)}
            >
              {entry}
            </Button>
          ))}
        </Flex>
        {error && (
          <Text role="alert" color="fg.error">
            {error}
          </Text>
        )}
      </Stack>
      <ScrollArea flex="1" minH="0">
        <Stack gap="xs" p="md">
          {filtered.map((canvas) => (
            <Button key={canvas.id} variant="ghost" justifyContent="space-between" onClick={() => void open(canvas.id)}>
              <Text truncate>{canvas.name}</Text>
              <Text color="fg.muted" textStyle="label/XS">
                {canvas.items.some((item) => item.preview?.kind === "design") ? "Reference" : canvas.items.length}
              </Text>
            </Button>
          ))}
          {!filtered.length && <Text p="md">No matching designs</Text>}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};
