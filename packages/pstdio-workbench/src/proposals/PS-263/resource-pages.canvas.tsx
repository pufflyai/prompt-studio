import { Box, Button, Flex, HStack, IconButton, Tabs, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { Breadcrumb, Header, ResourceActionMenu } from "@pstdio/ui";
import { useState } from "react";
import { WorkbenchIcon } from "../../react/shared/icon";

export default {
  title: "Proposals/PS-263 Movable resource pages",
  description: "One Main header, page and tab presentations, and individual-page transfer. Synthetic data only.",
} satisfies CanvasMeta;

export const Interactive = () => {
  const [page, setPage] = useState("Session A");
  const [tabs, setTabs] = useState(["Note B"]);
  const [selected, setSelected] = useState("Note B");
  const [side, setSide] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string>();
  const [draft, setDraft] = useState("Draft stays with Session A");
  const isHome = page === "Home";
  const move = (name: string, destination: "main" | "side" | "tabs") => {
    setTabs((items) => items.filter((item) => item !== name));
    setSide((items) => items.filter((item) => item !== name));
    if (destination === "main") setPage(name);
    else {
      if (destination === "side") setSide((items) => [...items.filter((item) => item !== name), name]);
      if (destination === "tabs") {
        setTabs((items) => [...items.filter((item) => item !== name), name]);
        setSelected(name);
      }
      if (page === name) setPage("Home");
    }
    setDragging(undefined);
  };
  const actions = (name: string) => [
    { key: "side", label: "Move to Side", onClick: () => move(name, "side") },
    { key: "main", label: "Open in Main", onClick: () => move(name, "main") },
    { key: "tabs", label: "Move to Home tabs", onClick: () => move(name, "tabs") },
  ];
  return (
    <Flex direction="column" h="full" minH="80" gap="md">
      <HStack gap="xs" wrap="wrap">
        {["Home", "Session A", "Note B", "Ticket PS-123", "UI Canvas", "Workspaces"].map((name) => (
          <Button key={name} variant="ghost" size="sm" onClick={() => move(name, "main")}>
            {name}
          </Button>
        ))}
      </HStack>
      <Flex flex="1" gap="xs" minW="0">
        <Flex direction="column" flex="1" minW="0" layerStyle="panel">
          <Header
            variant="main"
            draggable={!isHome}
            onDragStart={() => setDragging(page)}
            onDragEnd={() => setDragging(undefined)}
          >
            <IconButton aria-label="Navigate back" size="xs" variant="ghost">
              <WorkbenchIcon name="arrow-left" size={14} />
            </IconButton>
            <IconButton aria-label="Navigate forward" size="xs" variant="ghost">
              <WorkbenchIcon name="arrow-right" size={14} />
            </IconButton>
            {isHome ? (
              <Box
                flex="1"
                minW="0"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dragging && move(dragging, "tabs")}
              >
                <Tabs.Root
                  value={selected}
                  onValueChange={({ value }) => setSelected(value)}
                  size="sm"
                  variant="subtle"
                >
                  <Tabs.List>
                    {tabs.map((name) => (
                      <Tabs.Trigger
                        key={name}
                        value={name}
                        draggable
                        onDragStart={(event) => {
                          event.stopPropagation();
                          setDragging(name);
                        }}
                      >
                        {name}
                        <IconButton
                          as="span"
                          aria-label={`Close ${name}`}
                          size="xs"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            setTabs((items) => items.filter((item) => item !== name));
                          }}
                        >
                          <WorkbenchIcon name="x" size={14} />
                        </IconButton>
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </Tabs.Root>
              </Box>
            ) : (
              <>
                <Breadcrumb items={[{ title: "Project" }, { title: page }]} separator="/" />
                <ResourceActionMenu actions={actions(page)}>
                  <IconButton aria-label={`Actions for ${page}`} variant="ghost" size="xs">
                    <WorkbenchIcon name="chevron-down" size={14} />
                  </IconButton>
                </ResourceActionMenu>
                <Box flex="1" />
              </>
            )}
            <ResourceActionMenu actions={[{ key: "properties", label: "Properties", onClick: () => undefined }]}>
              <IconButton aria-label="View menus" variant="ghost" size="xs">
                <WorkbenchIcon name="panel-right" size={14} />
              </IconButton>
            </ResourceActionMenu>
          </Header>
          <Box flex="1" p="md">
            <Text>{isHome ? selected : page}</Text>
          </Box>
          <Text
            p="md"
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => setDraft(event.currentTarget.textContent ?? "")}
          >
            {draft}
          </Text>
        </Flex>
        <Flex
          direction="column"
          minW="40"
          flex="1"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => dragging && move(dragging, "side")}
          layerStyle="panel"
        >
          <Header>
            <Text>Side</Text>
          </Header>
          {side.map((name) => (
            <ResourceActionMenu key={name} actions={actions(name)}>
              <Box p="md" draggable onDragStart={() => setDragging(name)}>
                {name}
              </Box>
            </ResourceActionMenu>
          ))}
        </Flex>
      </Flex>
    </Flex>
  );
};
