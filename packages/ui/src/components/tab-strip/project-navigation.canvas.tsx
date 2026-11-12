import { Box, Stack, Text } from "@chakra-ui/react";
import { MessageCircle, Pin, Settings } from "lucide-react";
import { useState } from "react";
import { TreeList } from "../tree-list/tree-list";
import { WindowTabs } from "./window-tabs";
import { WindowTitleBar } from "./window-title-bar";

export default { title: "Design system/Patterns/Tabs/Project navigation", fullscreen: true };
export const Navigation = () => {
  const [selected, setSelected] = useState("studio");
  const [pinned, setPinned] = useState(true);
  const [settings, setSettings] = useState<string>();
  const nodes = [
    {
      id: "review",
      isNavigable: true,
      label: "Review the release",
      icon: <MessageCircle />,
      contextMenuItems: [
        { id: "pin", label: pinned ? "Unpin session" : "Pin session", icon: Pin, onAction: () => setPinned(!pinned) },
      ],
    },
    { id: "build", isNavigable: true, label: "Build the next tool", icon: <MessageCircle /> },
  ];
  return (
    <Stack h="full">
      <WindowTitleBar platform="darwin">
        <WindowTabs
          aria-label="Project tabs"
          selectedId={selected}
          onSelect={setSelected}
          onClose={() => setSelected("docs")}
          tabs={["studio", "docs"].map((id) => ({
            id,
            label: id === "studio" ? "Prompt Studio" : "Documentation",
            closable: id === selected,
            contextActions: [
              {
                key: "settings",
                label: "Project settings",
                icon: <Settings />,
                onClick: () => {
                  setSelected(id);
                  setSettings(id);
                },
              },
            ],
          }))}
        />
      </WindowTitleBar>
      {settings ? <Text>Project settings · {settings}</Text> : null}
      <Box w="xs">
        <TreeList
          sections={
            pinned
              ? [
                  { id: "pinned", label: "Pinned", nodes: [nodes[0]] },
                  { id: "recent", label: "Today", nodes: [nodes[1]] },
                ]
              : [{ id: "recent", label: "Today", nodes }]
          }
        />
      </Box>
    </Stack>
  );
};
