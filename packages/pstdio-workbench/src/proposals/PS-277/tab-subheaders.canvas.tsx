import { Box, Button, HStack, Input, Stack, Tabs, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { Header, ScrollArea } from "@pstdio/ui";
import { useState } from "react";

const destinations = ["Main", "Side", "Secondary"] as const;
type Destination = (typeof destinations)[number];
const destinationLabels: Record<Destination, string> = {
  Main: "Move to Main",
  Side: "Move to Side",
  Secondary: "Move to Bottom (Secondary)",
};
const extensions = ["Planner", "Notes", "UI Canvas"];

export default {
  title: "Proposals/PS-277 Tab subheaders",
  description:
    "Move the same content between presentations. Controls and menus belong below tabs; every tab strip keeps its bottom border.",
  fullscreen: true,
} satisfies CanvasMeta;

const PreviewContent = ({
  showExtensions,
  active,
  search,
}: {
  showExtensions: boolean;
  active: string;
  search: string;
}) => {
  const visible = extensions.filter((name) => name.toLowerCase().includes(search.toLowerCase()));
  return (
    <ScrollArea flex="1" minH="0">
      <Stack padding="md" gap="md">
        {showExtensions ? (
          visible.map((name) => (
            <Text key={name} textStyle="label/S/regular">
              {name}
            </Text>
          ))
        ) : (
          <Text textStyle="paragraph/S/regular">
            {active === "notes" ? "Notes content" : "Readme content without header controls or view menus"}
          </Text>
        )}
        {showExtensions && visible.length === 0 ? (
          <Text textStyle="label/S/regular">No matching extensions</Text>
        ) : null}
      </Stack>
    </ScrollArea>
  );
};

const PreviewMenu = ({ showExtensions }: { showExtensions: boolean }) => (
  <Stack id="proposal-view-menu" width="48" padding="md" borderRightWidth="1px" borderColor="border.subtle">
    <Text textStyle="label/S/medium">{showExtensions ? "Extension filters" : "Notes outline"}</Text>
    <Text textStyle="label/S/regular">{showExtensions ? "All installed extensions" : "Introduction"}</Text>
  </Stack>
);

export const PageAndTabSubheaders = () => {
  const [destination, setDestination] = useState<Destination>("Main");
  const [tabbed, setTabbed] = useState(true);
  const [active, setActive] = useState("extensions");
  const [search, setSearch] = useState("");
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [upgraded, setUpgraded] = useState(false);
  const hasTabs = destination !== "Main" || tabbed;
  const showExtensions = !hasTabs || active === "extensions";
  const contentId = showExtensions ? "extensions" : active;
  const menuOpen = openMenus[contentId] ?? false;
  const hasHeader = showExtensions || active === "notes";

  const menus = (
    <Button
      size="xs"
      variant="ghost"
      aria-expanded={menuOpen}
      aria-controls="proposal-view-menu"
      onClick={() => setOpenMenus((value) => ({ ...value, [contentId]: !menuOpen }))}
    >
      {showExtensions ? "Filters" : "Outline"}
    </Button>
  );
  const controls = showExtensions ? (
    <HStack flex="1" minW="0" gap="sm">
      <Box flex="1" />
      <Button size="xs" variant="primary" disabled={upgraded} onClick={() => setUpgraded(true)}>
        {upgraded ? "Up to date" : "Upgrade all"}
      </Button>
      <Input
        size="xs"
        width="48"
        minW="0"
        placeholder="Search extensions…"
        aria-label="Search extensions"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </HStack>
  ) : (
    <Text flex="1" textStyle="label/S/medium">
      Notes controls
    </Text>
  );

  return (
    <Stack padding="md" gap="md" bg="bg" color="fg" h="full">
      <Text textStyle="label/S/medium">Preview controls · same content instance in each destination</Text>
      <HStack gap="sm" flexWrap="wrap">
        {destinations.map((name) => (
          <Button
            key={name}
            size="xs"
            variant={destination === name ? "primary" : "outline"}
            onClick={() => setDestination(name)}
          >
            {destinationLabels[name]}
          </Button>
        ))}
        <Button
          size="xs"
          variant="outline"
          disabled={destination !== "Main"}
          onClick={() => setTabbed((value) => !value)}
        >
          {tabbed ? "Show standalone page" : "Show in tabs"}
        </Button>
      </HStack>
      <Stack gap="0" borderWidth="1px" borderColor="border.subtle" flex="1" minH="0" overflow="hidden">
        {hasTabs ? (
          <Header variant="main" flexShrink={0} borderBottomWidth="1px" borderColor="border.subtle">
            <Tabs.Root value={active} onValueChange={({ value }) => setActive(value)} size="sm" variant="subtle">
              <Tabs.List>
                <Tabs.Trigger value="extensions">Extensions</Tabs.Trigger>
                <Tabs.Trigger value="notes">Notes</Tabs.Trigger>
                <Tabs.Trigger value="readme">Readme</Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>
          </Header>
        ) : null}
        {hasHeader ? (
          <Header
            variant={hasTabs ? "narrow" : "main"}
            flexShrink={0}
            borderBottomWidth="1px"
            borderColor="border.subtle"
            gap="sm"
          >
            {!hasTabs ? <Text textStyle="label/S/medium">← → · Extensions</Text> : null}
            {controls}
            {menus}
          </Header>
        ) : null}
        <HStack align="stretch" gap="0" flex="1" minH="0">
          {hasHeader && menuOpen ? <PreviewMenu showExtensions={showExtensions} /> : null}
          <PreviewContent showExtensions={showExtensions} active={active} search={search} />
        </HStack>
      </Stack>
    </Stack>
  );
};
