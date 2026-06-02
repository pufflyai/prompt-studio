import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DataRenderer } from "./data-renderer";
import { attributes, type StoryRow } from "./data-renderer-story-fixtures";
import type { AttributeDescriptor, EnumOption, EnumOptionsSource } from "./types";
import { useDataRendererStore } from "./use-data-renderer-store";

const meta: Meta<typeof DataRenderer> = {
  title: "Patterns/Data Renderer/Data Renderer",
  component: DataRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const LIVE_STORAGE_KEY = "storybook-data-renderer-live";

const ADDABLE_STATUSES: EnumOption[] = [
  { value: "review", label: "Review", color: "purple" },
  { value: "blocked", label: "Blocked", color: "red" },
  { value: "shipped", label: "Shipped", color: "cyan" },
  { value: "archived", label: "Archived", color: "gray" },
];

const INITIAL_LIVE_STATUSES: EnumOption[] = [
  { value: "todo", label: "Todo", color: "gray" },
  { value: "in_progress", label: "In progress", color: "blue" },
  { value: "done", label: "Done", color: "green" },
];

const COLOR_CYCLE = ["gray", "blue", "green", "red", "purple", "yellow", "cyan", "orange"] as const;

const nextColor = (current: string | undefined) => {
  const index = COLOR_CYCLE.indexOf(current as (typeof COLOR_CYCLE)[number]);
  return COLOR_CYCLE[(index + 1) % COLOR_CYCLE.length]!;
};

const createEnumOptionsStore = (initial: EnumOption[]) => {
  let options = initial;
  const listeners = new Set<() => void>();

  const source: EnumOptionsSource = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => options,
  };

  const setOptions = (next: EnumOption[]) => {
    options = next;
    for (const listener of listeners) listener();
  };

  return { source, setOptions, getOptions: () => options };
};

const LIVE_INITIAL_ROWS: StoryRow[] = [
  {
    id: "live-1",
    title: "Set up API authentication",
    attributes: {
      status: "todo",
      assignee: "Alex",
      component: "backend",
      priority: "high",
      updated: "2026-03-15T12:00:00.000Z",
    },
  },
  {
    id: "live-2",
    title: "Build row list interactions",
    attributes: {
      status: "in_progress",
      assignee: "Sam",
      component: "frontend",
      priority: "medium",
      updated: "2026-03-16T12:00:00.000Z",
    },
  },
  {
    id: "live-3",
    title: "Write docs",
    attributes: { status: "done", assignee: "Taylor", component: "docs", updated: "2026-03-17T12:00:00.000Z" },
  },
];

const createLiveScene = () => {
  const store = createEnumOptionsStore(INITIAL_LIVE_STATUSES);
  const liveAttributes: AttributeDescriptor[] = [
    {
      id: "status",
      label: "Status",
      type: { kind: "enum", options: store.source },
      filterable: true,
      groupable: true,
      sortable: true,
      displayable: true,
      editable: true,
    },
    ...attributes.filter((attribute) => attribute.id !== "status"),
  ];
  return { store, liveAttributes };
};

const switchToListView = async (canvas: ReturnType<typeof within>) => {
  await userEvent.click(canvas.getByLabelText("Display settings"));
  await userEvent.click(within(document.body).getByText("List"));
};

const getVisibleBadgeByText = (text: string) =>
  [...document.body.querySelectorAll<HTMLElement>(".chakra-badge")].find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && element.textContent?.trim() === text;
  });

const getVisibleListGroupCountBadge = (label: string) => {
  const groupRow = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (element) => element.textContent?.replace(/\s+/g, "").trim() === `${label}1`,
  );
  return groupRow?.querySelector<HTMLElement>(".chakra-badge") ?? null;
};

const LiveWrapper = () => {
  const [{ store, liveAttributes }] = useState(createLiveScene);
  const [statuses, setStatuses] = useState<EnumOption[]>(() => store.getOptions());
  const [rows, setRows] = useState<StoryRow[]>(LIVE_INITIAL_ROWS);
  const nextRowId = useRef(LIVE_INITIAL_ROWS.length + 1);
  const reset = useDataRendererStore(LIVE_STORAGE_KEY, (state) => state.reset);
  const setColumnGrouping = useDataRendererStore(LIVE_STORAGE_KEY, (state) => state.setColumnGrouping);

  useEffect(() => {
    reset();
    setColumnGrouping("status");
  }, [reset, setColumnGrouping]);

  useEffect(() => store.source.subscribe(() => setStatuses([...store.getOptions()])), [store]);

  const handleAddStatus = () => {
    const taken = new Set(statuses.map((option) => option.value));
    const next = ADDABLE_STATUSES.find((option) => !taken.has(option.value));
    if (!next) return;
    store.setOptions([...statuses, next]);
  };

  const handleRemoveLastStatus = () => {
    if (statuses.length <= 1) return;
    store.setOptions(statuses.slice(0, -1));
  };

  const handleRenameLastStatus = () => {
    if (statuses.length === 0) return;
    const last = statuses[statuses.length - 1]!;
    const updated: EnumOption = { ...last, label: `${last.label} *` };
    store.setOptions([...statuses.slice(0, -1), updated]);
  };

  const handleRecolorLastStatus = () => {
    if (statuses.length === 0) return;
    const last = statuses[statuses.length - 1]!;
    const updated: EnumOption = { ...last, color: nextColor(last.color) };
    store.setOptions([...statuses.slice(0, -1), updated]);
  };

  const handleAddRow = () => {
    const status = statuses[statuses.length - 1]?.value ?? "todo";
    const id = `live-${nextRowId.current++}`;
    setRows((current) => [
      ...current,
      {
        id,
        title: `New task in ${status}`,
        attributes: {
          status,
          assignee: "Pat",
          component: "backend",
          priority: "medium",
          updated: new Date().toISOString(),
        },
      },
    ]);
  };

  const handleAttributeChange = (rowId: string, attributeId: string, value: unknown) =>
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
      ),
    );

  return (
    <Stack p="sm" height="640px" gap="sm">
      <Stack gap="2xs">
        <HStack gap="2xs" flexWrap="wrap">
          <Button size="sm" variant="outline" onClick={handleAddStatus}>
            Add status
          </Button>
          <Button size="sm" variant="outline" onClick={handleRenameLastStatus}>
            Rename last
          </Button>
          <Button size="sm" variant="outline" onClick={handleRecolorLastStatus}>
            Recolor last
          </Button>
          <Button size="sm" variant="outline" onClick={handleRemoveLastStatus}>
            Remove last
          </Button>
          <Button size="sm" variant="outline" onClick={handleAddRow}>
            Add row in latest status
          </Button>
        </HStack>
        <HStack gap="2xs" flexWrap="wrap">
          <Text textStyle="label/XS/regular" color="fg.muted">
            Live options:
          </Text>
          {statuses.map((option) => (
            <Badge
              key={option.value}
              variant="subtle"
              colorPalette={option.color ?? "gray"}
              textStyle="label/XS/medium"
            >
              {option.label}
            </Badge>
          ))}
        </HStack>
      </Stack>
      <Box flex="1" minH="0">
        <DataRenderer<StoryRow>
          rows={rows}
          storageKey={LIVE_STORAGE_KEY}
          attributes={liveAttributes}
          onAttributeChange={handleAttributeChange}
          getBoardColumnConfig={(groupKey) => {
            const option = statuses.find((entry) => entry.value === groupKey);
            return { color: option?.color, canDragIn: true, canDragOut: true };
          }}
        />
      </Box>
    </Stack>
  );
};

export const LiveOptions: Story = {
  tags: ["live-options-regression"],
  render: () => <LiveWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchToListView(canvas);

    const beforeLiveBadge = getVisibleBadgeByText("Done");
    const beforeListBadge = getVisibleListGroupCountBadge("Done");
    if (!beforeLiveBadge || !beforeListBadge) throw new Error("Expected visible Done badges before recoloring");
    const beforeListBackground = getComputedStyle(beforeListBadge).backgroundColor;

    await userEvent.click(canvas.getByRole("button", { name: "Recolor last" }));

    const liveBadge = getVisibleBadgeByText("Done");
    const listBadge = getVisibleListGroupCountBadge("Done");
    if (!liveBadge || !listBadge) throw new Error("Expected visible Done badges after recoloring");

    await expect(getComputedStyle(listBadge).backgroundColor).toBe(getComputedStyle(liveBadge).backgroundColor);
    await expect(getComputedStyle(listBadge).backgroundColor).not.toBe(beforeListBackground);
  },
};
