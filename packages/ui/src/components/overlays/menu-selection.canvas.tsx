import { Button, Icon, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Check, GitBranch, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ScopedMenu as Menu } from "@/utils/scoped-overlays";
import { ResourceActionMenu } from "./resource-context-menu";
import { SearchableMenu } from "./searchable-menu";

const SelectionMenus = () => {
  const [branch, setBranch] = useState("main");
  const [pinned, setPinned] = useState(true);
  return (
    <Stack align="start">
      <Menu.Root closeOnSelect={false}>
        <Menu.Trigger asChild>
          <Button>Layout options</Button>
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
      <ResourceActionMenu
        actions={[
          { key: "main", label: "Main panel", icon: <GitBranch />, isSelected: true },
          { key: "reset", label: "Reset layout", icon: <RotateCcw /> },
        ]}
      >
        <Button>Resource options</Button>
      </ResourceActionMenu>
    </Stack>
  );
};
const meta = {
  tags: ["menu-selection"],
  title: "Components/Overlays/Menu Selection",
  component: SelectionMenus,
} satisfies CanvasMeta<typeof SelectionMenus>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const CheckmarksAndAlignment: Story = {
  id: "components-overlays-menu-selection--checkmarks-and-alignment",
};
