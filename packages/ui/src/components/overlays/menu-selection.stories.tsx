import { Button, Icon, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Check, GitBranch, RotateCcw } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
} satisfies Meta<typeof SelectionMenus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CheckmarksAndAlignment: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Layout options" }));
    const pinned = body.getByRole("menuitemcheckbox", { name: "Pinned" });
    await expect(pinned).toBeChecked();
    const label = within(pinned).getByText("Pinned").getBoundingClientRect();
    const indicator = pinned.querySelector("[data-part=item-indicator]")!.getBoundingClientRect();
    expect(indicator.left).toBeGreaterThan(label.right);
    expect(getComputedStyle(pinned).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    const reset = body.getByRole("menuitem", { name: "Reset layout" });
    const resetIcon = reset.querySelector("svg")!.getBoundingClientRect();
    expect(pinned.querySelector(".lucide-git-branch")!.getBoundingClientRect().left).toBe(resetIcon.left);
    expect(within(reset).getByText("Reset layout").getBoundingClientRect().left - resetIcon.right).toBeLessThanOrEqual(
      8,
    );
    await userEvent.click(pinned);
    await expect(pinned).not.toBeChecked();
    const release = body.getByRole("menuitemradio", { name: "release" });
    await userEvent.keyboard("{Home}{ArrowDown}{ArrowDown}{Enter}");
    await expect(release).toBeChecked();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByRole("button", { name: "Select branches" }));
    await expect(body.getByRole("menuitemcheckbox", { name: "release" })).toBeChecked();
    await userEvent.click(body.getByRole("menuitemcheckbox", { name: "main" }));
    await expect(body.getByRole("menuitemcheckbox", { name: "main" })).toBeChecked();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByRole("button", { name: "Resource options" }));
    await waitFor(() => expect(body.getByRole("menuitem", { name: "Main panel" })).toBeVisible());
  },
};
