import { Box, Button, Icon, Menu } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { FolderGit2, GitBranch } from "lucide-react";
import { useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { ListRow } from "./list-row/list-row";
import { SearchableMenu, type SearchableMenuItem } from "./searchable-menu";

const branchItems: SearchableMenuItem[] = Array.from({ length: 18 }, (_, index) => {
  const branchName = index === 0 ? "main" : `feature/searchable-menu-${index}`;

  return {
    id: branchName,
    label: branchName,
    searchText: `origin/${branchName}`,
    icon: GitBranch,
    isSelected: branchName === "main",
  };
});

const repositoryItems: SearchableMenuItem[] = Array.from({ length: 12 }, (_, index) => {
  const repoName = index === 0 ? "prompt-studio" : `repo-browser-${index}`;

  return {
    id: repoName,
    label: repoName,
    searchText: `/repos/${repoName}`,
    icon: FolderGit2,
    isSelected: false,
  };
});

const meta: Meta<typeof SearchableMenu> = {
  title: "Navigation/SearchableMenu",
  component: SearchableMenu,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <Box maxWidth="320px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SearchableMenu>;

export const BranchSelector: Story = {
  render: () => (
    <SearchableMenu
      trigger={<Button variant="outline">Select branch</Button>}
      items={branchItems}
      searchPlaceholder="Search branches…"
      portalled={false}
      emptyState={
        <Menu.Item value="empty" asChild>
          <ListRow
            asChild
            variant="compact"
            label="No branches found"
            icon={<Icon as={GitBranch} boxSize="16px" />}
            disabled
          />
        </Menu.Item>
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Select branch" }));

    const searchInput = canvas.getByLabelText("Search branches…");
    await userEvent.type(searchInput, "origin/main");

    await expect(canvas.getByRole("option", { name: "main" })).toBeVisible();
    await expect(canvas.queryByRole("option", { name: "feature/searchable-menu-1" })).not.toBeInTheDocument();
  },
};

export const SwitchableLists: Story = {
  render: () => {
    const [selectedBranch, setSelectedBranch] = useState("main");
    const [selectedRepository, setSelectedRepository] = useState("prompt-studio");
    const repositoryLabel = repositoryItems.find((item) => item.id === selectedRepository)?.label ?? selectedRepository;

    return (
      <SearchableMenu
        trigger={<Button variant="outline">Switchable menu</Button>}
        items={branchItems.map((item) => ({
          ...item,
          isDisabled: item.id === "feature/searchable-menu-1",
          isSelected: item.id === selectedBranch,
          onSelect: () => setSelectedBranch(item.id),
        }))}
        searchPlaceholder="Search branches…"
        portalled={false}
        emptyState={
          <Menu.Item value="empty" asChild>
            <ListRow
              asChild
              variant="compact"
              label="No branches found"
              icon={<Icon as={GitBranch} boxSize="16px" />}
              disabled
            />
          </Menu.Item>
        }
        parentList={{
          items: repositoryItems.map((item) => ({
            ...item,
            isSelected: item.id === selectedRepository,
          })),
          selectedLabel: repositoryLabel,
          selectedIcon: FolderGit2,
          ariaLabel: "Toggle list",
          showSearch: true,
          searchPlaceholder: "Search repositories…",
          emptyState: (
            <Menu.Item value="empty" asChild>
              <ListRow
                asChild
                variant="compact"
                label="No repositories found"
                icon={<Icon as={FolderGit2} boxSize="16px" />}
                disabled
              />
            </Menu.Item>
          ),
          onSelect: (item) => setSelectedRepository(item.id),
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Switchable menu" }));

    const searchInput = canvas.getByLabelText("Search branches…");
    await userEvent.type(searchInput, "searchable-menu-");
    await expect(canvas.getByText("feature/searchable-menu-1")).toBeVisible();

    fireEvent.keyDown(searchInput, { key: "Home" });
    await expect(searchInput).toHaveFocus();

    fireEvent.keyDown(searchInput, { key: "End" });
    await expect(searchInput).toHaveFocus();

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    const focusedResult = canvas.getByRole("option", { name: "feature/searchable-menu-2" });
    await expect(focusedResult.closest("[data-searchable-menu-item]")).toHaveFocus();

    searchInput.focus();
    fireEvent.keyDown(searchInput, { key: "ArrowUp" });
    const lastResult = canvas.getByRole("option", { name: "feature/searchable-menu-17" });
    await expect(lastResult.closest("[data-searchable-menu-item]")).toHaveFocus();

    await userEvent.click(canvas.getByRole("button", { name: "Toggle list" }));

    const repositorySearchInput = canvas.getByLabelText("Search repositories…");
    await expect(repositorySearchInput).toHaveValue("");
    await userEvent.type(repositorySearchInput, "repo-browser-1");
    await expect(canvas.getByText("repo-browser-1")).toBeVisible();

    await userEvent.click(canvas.getByRole("option", { name: "repo-browser-1" }));

    // Menu stays open showing branches after parent selection
    const nextSearchInput = canvas.getByLabelText("Search branches…");
    await expect(nextSearchInput).toHaveValue("");

    const toggle = canvas.getByRole("button", { name: "Toggle list" });
    fireEvent.keyDown(toggle, { key: "Enter" });
    await expect(canvas.getByLabelText("Search repositories…")).toBeVisible();

    const spaceEvent = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    toggle.dispatchEvent(spaceEvent);
    await expect(canvas.getByLabelText("Search branches…")).toBeVisible();
    await expect(spaceEvent.defaultPrevented).toBe(true);
  },
};

export const DisabledParentList: Story = {
  render: () => (
    <SearchableMenu
      trigger={<Button variant="outline">Single repo</Button>}
      items={branchItems}
      searchPlaceholder="Search branches…"
      portalled={false}
      emptyState={
        <Menu.Item value="empty" asChild>
          <ListRow
            asChild
            variant="compact"
            label="No branches found"
            icon={<Icon as={GitBranch} boxSize="16px" />}
            disabled
          />
        </Menu.Item>
      }
      parentList={{
        items: [{ id: "prompt-studio", label: "prompt-studio", icon: FolderGit2 }],
        selectedLabel: "prompt-studio",
        selectedIcon: FolderGit2,
        ariaLabel: "Toggle list",
        disabled: true,
        emptyState: (
          <Menu.Item value="empty" asChild>
            <ListRow
              asChild
              variant="compact"
              label="No repositories found"
              icon={<Icon as={FolderGit2} boxSize="16px" />}
              disabled
            />
          </Menu.Item>
        ),
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Single repo" }));

    const toggle = canvas.getByRole("button", { name: "Toggle list" });
    await expect(toggle).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(toggle);
    await expect(canvas.getByLabelText("Search branches…")).toBeVisible();

    fireEvent.keyDown(toggle, { key: "Enter" });
    await expect(canvas.getByLabelText("Search branches…")).toBeVisible();

    fireEvent.keyDown(toggle, { key: " " });
    await expect(canvas.getByLabelText("Search branches…")).toBeVisible();
  },
};
