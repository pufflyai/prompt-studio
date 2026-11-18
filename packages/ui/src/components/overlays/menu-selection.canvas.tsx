import { Button, Icon, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Check, GitBranch, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ScopedMenu as Menu } from "@/utils/scoped-overlays";
import { ScrollArea } from "../primitives/scroll-area";
import { Tooltip } from "../primitives/tooltip";
import { ResourceActionMenu } from "./resource-context-menu";
import { SearchableMenu } from "./searchable-menu";

const SelectionMenus = () => {
  const [branch, setBranch] = useState("main");
  const [pinned, setPinned] = useState(true);
  const [longLabel, setLongLabel] = useState(false);
  const [explicitTooltip, setExplicitTooltip] = useState(false);
  const [revision, setRevision] = useState("first");
  const [savedVersion, setSavedVersion] = useState("version-1");
  const label = longLabel
    ? "Layout options — a long selected value whose full text remains available in a tooltip"
    : "Layout options";
  return (
    <Stack align="start">
      <Button onClick={() => setLongLabel((value) => !value)}>Toggle long dropdown label</Button>
      <Button onClick={() => setExplicitTooltip((value) => !value)}>Toggle explicit dropdown tooltip</Button>
      <Menu.Root closeOnSelect={false}>
        <Menu.Trigger asChild>
          {explicitTooltip ? (
            <Tooltip content="Explicit dropdown explanation">
              <Button maxWidth="64" minWidth="0">
                <Text truncate>{label}</Text>
              </Button>
            </Tooltip>
          ) : (
            <Button maxWidth="64" minWidth="0">
              <Text truncate>{label}</Text>
            </Button>
          )}
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.CheckboxItem
              value="pinned"
              checked={pinned}
              onCheckedChange={(checked) => setPinned(Boolean(checked))}
            >
              <Menu.ItemIndicator>
                <Check />
              </Menu.ItemIndicator>
              <Icon as={GitBranch} boxSize="3.5" />
              <Menu.ItemText>Pinned</Menu.ItemText>
            </Menu.CheckboxItem>
            <Menu.RadioItemGroup value={branch} onValueChange={(details) => setBranch(details.value)}>
              {["main", "release"].map((value) => (
                <Menu.RadioItem key={value} value={value}>
                  <Menu.ItemIndicator>
                    <Check />
                  </Menu.ItemIndicator>
                  <Icon as={GitBranch} boxSize="3.5" />
                  <Menu.ItemText>{value}</Menu.ItemText>
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>
            <Menu.Item value="reset">
              <Icon as={RotateCcw} boxSize="3.5" />
              <Text>Reset layout</Text>
            </Menu.Item>
            <Menu.Item value="shortcut">
              <Menu.ItemText>Open resource</Menu.ItemText>
              <Menu.ItemCommand>⌘O</Menu.ItemCommand>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      <SearchableMenu
        searchPlaceholder="Search"
        trigger={<Button>Select branches</Button>}
        showSearch={false}
        multiple
        closeOnSelect={false}
        emptyState={null}
        items={["main", "release"].map((id) => ({
          id,
          label: id,
          icon: GitBranch,
          isSelected: id === branch,
          onSelect: () => setBranch(id),
        }))}
      />
      <Menu.Root lazyMount unmountOnExit>
        <Menu.Trigger asChild>
          <Button>Saved versions</Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content maxHeight="64">
            <ScrollArea flex="1" minHeight="0" viewportProps={{ tabIndex: -1 }}>
              <Menu.RadioItemGroup value={savedVersion} onValueChange={(event) => setSavedVersion(event.value)}>
                {Array.from({ length: 60 }, (_, index) => (
                  <Menu.RadioItem key={index} value={`version-${index + 1}`}>
                    <Menu.ItemText>Saved revision {index + 1}</Menu.ItemText>
                    <Menu.ItemIndicator>
                      <Check />
                    </Menu.ItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioItemGroup>
            </ScrollArea>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      <ResourceActionMenu
        actions={[
          { key: "main", label: "Main panel", icon: <GitBranch />, isSelected: true },
          { key: "reset", label: "Reset layout", icon: <RotateCcw /> },
          ...["first", "second"].map((id) => ({
            key: id,
            label: id === "first" ? "First saved version" : "Second saved version",
            group: { id: "versions", label: "Versions", selectionMode: "single" as const },
            isSelected: revision === id,
            onClick: () => setRevision(id),
          })),
        ]}
      >
        <Button>Resource options</Button>
      </ResourceActionMenu>
    </Stack>
  );
};
const meta = {
  title: "Design system/Components/Overlays/Menu selection",
  component: SelectionMenus,
  description:
    "Clipped dropdown labels reveal their complete text on hover or keyboard focus. Short labels need no tooltip; opening the menu dismisses its label tooltip. Saved versions demonstrates bounded scrolling and Home/End keyboard navigation with focused rows kept in view.",
} satisfies CanvasMeta<typeof SelectionMenus>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const CheckmarksAndAlignment: Story = {
  id: "components-overlays-menu-selection--checkmarks-and-alignment",
};

export const PaleSelection: Story = {
  id: "components-overlays-menu-selection--pale-selection",
  defaultTheme: "vscode-flat-dark",
};
