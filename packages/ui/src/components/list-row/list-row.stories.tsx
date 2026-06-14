import { Box, Button, HStack, Kbd, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  ChevronDown,
  Circle,
  Copy,
  EllipsisVertical,
  FileText,
  Folder,
  Link,
  Plus,
  Star,
  Ticket,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { WorkspaceBadge } from "../workspace-badge";
import { ListRow } from "./list-row";
import type { ListRowItem } from "./list-row.types";

const meta: Meta<typeof ListRow> = {
  title: "Components/Data Display/List Row",
  component: ListRow,
  parameters: {
    docs: {
      description: {
        component:
          "Reusable row item surface for lists, menus, trees, and dense navigation. RULE: Subtitles/descriptions must add distinct context and never contain the same information as the title.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ListRow>;

const baseItem: ListRowItem = {
  id: "overview",
  label: "Overview",
  icon: <FileText size={14} />,
};

const SectionLabel = (props: { children: string }) => (
  <Text textStyle="label/XS" color="fg.muted" textTransform="uppercase" letterSpacing="0.08em">
    {props.children}
  </Text>
);

export const States: Story = {
  render: () => (
    <Stack gap="md" maxW="22rem">
      <Stack gap="2xs">
        <SectionLabel>Default</SectionLabel>
        <ListRow {...baseItem} />
        <ListRow {...{ ...baseItem, description: "Project entry point and high-level summary" }} />
        <ListRow {...baseItem} isSelected />
        <ListRow {...{ ...baseItem, label: "Run pipeline", description: "Coming soon", disabled: true }} />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Compact</SectionLabel>
        <ListRow {...baseItem} variant="compact" />
        <ListRow {...{ ...baseItem, description: "Project entry point and high-level summary" }} variant="compact" />
        <ListRow {...baseItem} variant="compact" isSelected />
        <ListRow
          {...{ ...baseItem, label: "Run pipeline", description: "Coming soon", disabled: true }}
          variant="compact"
        />
      </Stack>
    </Stack>
  ),
};

export const Tones: Story = {
  render: () => (
    <Stack gap="md" maxW="22rem">
      <Stack gap="2xs">
        <SectionLabel>Default tone</SectionLabel>
        <ListRow {...{ ...baseItem, label: "Open file" }} />
        <ListRow {...{ ...baseItem, label: "Open file" }} variant="compact" />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Danger tone</SectionLabel>
        <ListRow {...{ id: "delete", label: "Delete project", icon: <Trash2 size={14} /> }} tone="danger" />
        <ListRow
          {...{
            id: "delete-desc",
            label: "Delete project",
            description: "This action cannot be undone",
            icon: <Trash2 size={14} />,
          }}
          tone="danger"
        />
        <ListRow
          {...{ id: "delete-c", label: "Delete project", icon: <Trash2 size={14} /> }}
          tone="danger"
          variant="compact"
        />
      </Stack>
    </Stack>
  ),
};

export const Decorations: Story = {
  render: () => (
    <Stack gap="md" maxW="22rem">
      <Stack gap="2xs">
        <SectionLabel>Indicator + colored icon</SectionLabel>
        <ListRow
          {...{
            ...baseItem,
            label: "Pipeline run",
            indicator: { icon: <Circle size={8} />, color: "green.500", tooltip: "Running" },
          }}
        />
        <ListRow
          {...{
            ...baseItem,
            label: "Starred",
            icon: <Star size={14} />,
            iconColor: "yellow.500",
          }}
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Two texts in a row</SectionLabel>
        <ListRow
          {...{
            id: "ticket",
            icon: <Ticket size={14} />,
            label: (
              <HStack gap="2">
                <Text textStyle="label/M/regular" color="fg.muted" flexShrink={0}>
                  PST-1
                </Text>
                <Text textStyle="label/M/regular" truncate>
                  Ship the unified ListRow component
                </Text>
              </HStack>
            ),
          }}
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Tooltip on hover</SectionLabel>
        <ListRow {...{ ...baseItem, label: "Hover me", tooltip: "Project entry point" }} />
        <ListRow
          {...{
            ...baseItem,
            label: "With Kbd tooltip",
            tooltip: (
              <HStack gap="2xs">
                <Text textStyle="label/XS">Press</Text>
                <Kbd size="sm">⌘</Kbd>
                <Kbd size="sm">O</Kbd>
              </HStack>
            ),
          }}
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>End content (Kbd)</SectionLabel>
        <ListRow
          {...{
            ...baseItem,
            label: "Open palette",
            endContent: (
              <HStack gap="2xs">
                <Kbd size="sm">⌘</Kbd>
                <Kbd size="sm">K</Kbd>
              </HStack>
            ),
          }}
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Truncation</SectionLabel>
        <ListRow
          {...{
            id: "long",
            icon: <FileText size={14} />,
            label:
              "An extremely long ticket title that absolutely will not fit inside the row and must therefore be truncated with an ellipsis",
            description:
              "Likewise, this description goes on and on, eventually wrapping or truncating depending on the available container width.",
          }}
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Workspace badge in subtitle slot</SectionLabel>
        <ListRow
          {...{
            id: "ws-sub-1",
            label: "Triage failing e2e suite",
            icon: <Ticket size={14} />,
            description: (
              <WorkspaceBadge
                workspaceType="worktree"
                shorthand="ws-3"
                attemptStatus={{ name: "Running", color: "blue" }}
                sessionStatus="completed"
                diffAdditions={42}
                diffDeletions={7}
              />
            ),
          }}
        />
        <ListRow
          {...{
            id: "ws-sub-2",
            label: "Migrate auth middleware",
            icon: <Ticket size={14} />,
            description: (
              <WorkspaceBadge
                workspaceType="current_branch"
                shorthand="main"
                attemptStatus={{ name: "Failed", color: "red" }}
                sessionStatus="failed"
              />
            ),
          }}
          variant="compact"
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Workspace badge as end content</SectionLabel>
        <ListRow
          {...{
            id: "ws-1",
            label: "Triage failing e2e suite",
            description: "PST-128",
            icon: <Ticket size={14} />,
            endContent: (
              <WorkspaceBadge
                workspaceType="worktree"
                shorthand="ws-3"
                attemptStatus={{ name: "Running", color: "blue" }}
                sessionStatus="completed"
                diffAdditions={42}
                diffDeletions={7}
              />
            ),
          }}
        />
        <ListRow
          {...{
            id: "ws-2",
            label: "Migrate auth middleware",
            description: "PST-204",
            icon: <Ticket size={14} />,
            endContent: (
              <WorkspaceBadge
                workspaceType="current_branch"
                shorthand="main"
                attemptStatus={{ name: "Failed", color: "red" }}
                sessionStatus="failed"
              />
            ),
          }}
          variant="compact"
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Right icon + long content</SectionLabel>
        <ListRow
          {...{
            id: "long-with-end",
            icon: <FileText size={14} />,
            label:
              "An extremely long ticket title that competes with end content for horizontal space and must truncate gracefully",
            description: "Plus a description that is also quite long and needs to share the row with a Kbd shortcut.",
            endContent: (
              <HStack gap="2xs">
                <Kbd size="sm">⌘</Kbd>
                <Kbd size="sm">↵</Kbd>
              </HStack>
            ),
          }}
        />
      </Stack>
    </Stack>
  ),
};

export const Interactions: Story = {
  render: () => (
    <Stack gap="md" maxW="22rem">
      <Stack gap="2xs">
        <SectionLabel>Hover actions</SectionLabel>
        <ListRow
          {...{
            ...baseItem,
            actions: [
              { id: "add", label: "Add", icon: <Plus size={14} />, onAction: () => {} },
              {
                id: "more",
                label: "More",
                icon: <EllipsisVertical size={14} />,
                menuItems: [
                  { id: "copy-link", label: "Copy link", icon: <Link size={14} /> },
                  { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
                ],
              },
            ],
          }}
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Context menu (right-click)</SectionLabel>
        <ListRow
          {...{
            ...baseItem,
            contextMenuItems: [
              { id: "rename", label: "Rename" },
              { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
            ],
          }}
        />
      </Stack>
    </Stack>
  ),
};

export const ShortcutSlots: Story = {
  render: () => (
    <Stack gap="md" maxW="22rem">
      <Stack gap="2xs">
        <SectionLabel>Action tooltip with Kbd hint (hover the icon)</SectionLabel>
        <ListRow
          {...{
            ...baseItem,
            actions: [
              {
                id: "add",
                label: "Add",
                icon: <Plus size={14} />,
                tooltip: (
                  <HStack gap="2">
                    <Text>Add</Text>
                    <Kbd>⌘N</Kbd>
                  </HStack>
                ),
                onAction: () => {},
              },
              { id: "copy", label: "Copy", icon: <Copy size={14} />, onAction: () => {} },
            ],
          }}
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Action menu items with trailing Kbd (open menu)</SectionLabel>
        <ListRow
          {...{
            ...baseItem,
            actions: [
              {
                id: "more",
                label: "More",
                icon: <EllipsisVertical size={14} />,
                menuItems: [
                  {
                    id: "copy-link",
                    label: "Copy link",
                    icon: <Link size={14} />,
                    endContent: <Kbd>⌘C</Kbd>,
                  },
                  {
                    id: "delete",
                    label: "Delete",
                    icon: <Trash2 size={14} />,
                    endContent: <Kbd>⌫</Kbd>,
                  },
                ],
              },
            ],
          }}
        />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Context menu items with trailing Kbd (right-click)</SectionLabel>
        <ListRow
          {...{
            ...baseItem,
            contextMenuItems: [
              { id: "rename", label: "Rename", endContent: <Kbd>F2</Kbd> },
              { id: "delete", label: "Delete", icon: <Trash2 size={14} />, endContent: <Kbd>⌫</Kbd> },
            ],
          }}
        />
      </Stack>
    </Stack>
  ),
};

const folderItem: ListRowItem = {
  id: "src",
  label: "src",
  icon: <Folder size={14} />,
  isContainer: true,
};

const ExpandableExample = () => {
  const [expanded, setExpanded] = useState(true);
  return (
    <ListRow
      {...folderItem}
      showExpandToggle
      isExpanded={expanded}
      onToggleExpand={() => setExpanded((current) => !current)}
    />
  );
};

export const Tree: Story = {
  render: () => (
    <Stack gap="md" maxW="22rem">
      <Stack gap="2xs">
        <SectionLabel>Expandable container</SectionLabel>
        <ExpandableExample />
      </Stack>
      <Stack gap="2xs">
        <SectionLabel>Nested at depth</SectionLabel>
        <Stack gap="0">
          <ListRow {...folderItem} showExpandToggle isExpanded depth={0} variant="tree" />
          <ListRow {...{ ...baseItem, id: "nested-1", label: "index.ts" }} depth={1} variant="tree" />
          <ListRow
            {...{ ...folderItem, id: "components", label: "components" }}
            showExpandToggle
            isExpanded
            depth={1}
            variant="tree"
          />
          <ListRow {...{ ...baseItem, id: "nested-2", label: "button.tsx" }} depth={2} variant="tree" />
          <ListRow {...{ ...baseItem, id: "nested-3", label: "input.tsx" }} depth={2} variant="tree" isSelected />
        </Stack>
      </Stack>
    </Stack>
  ),
};

const dropdownItems: (ListRowItem & { id: string })[] = [
  {
    id: "open",
    label: "Open",
    icon: <FileText size={14} />,
    endContent: (
      <HStack gap="2xs">
        <Kbd size="sm">⌘</Kbd>
        <Kbd size="sm">O</Kbd>
      </HStack>
    ),
  },
  {
    id: "duplicate",
    label: "Duplicate",
    icon: <Copy size={14} />,
    endContent: (
      <HStack gap="2xs">
        <Kbd size="sm">⌘</Kbd>
        <Kbd size="sm">D</Kbd>
      </HStack>
    ),
  },
  {
    id: "copy-link",
    label: "Copy link",
    description: "Share a permalink to this item",
    icon: <Link size={14} />,
  },
  {
    id: "delete",
    label: "Delete",
    icon: <Trash2 size={14} />,
    disabled: true,
  },
];

const MenuExample = (props: { variant: "default" | "compact"; label: string }) => (
  <Menu.Root>
    <Menu.Trigger asChild>
      <Button>
        {props.label}
        <ChevronDown size={14} />
      </Button>
    </Menu.Trigger>
    <Portal>
      <Menu.Positioner>
        <Menu.Content>
          {dropdownItems.map((item) => (
            <Menu.Item key={item.id} value={item.id} disabled={item.disabled} asChild>
              <ListRow asChild {...item} variant={props.variant} />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  </Menu.Root>
);

export const InsideMenu: Story = {
  render: () => (
    <Box>
      <Stack gap="md">
        <Stack gap="2xs">
          <SectionLabel>Default</SectionLabel>
          <MenuExample variant="default" label="Open default menu" />
        </Stack>
        <Stack gap="2xs">
          <SectionLabel>Compact</SectionLabel>
          <MenuExample variant="compact" label="Open compact menu" />
        </Stack>
      </Stack>
    </Box>
  ),
};
