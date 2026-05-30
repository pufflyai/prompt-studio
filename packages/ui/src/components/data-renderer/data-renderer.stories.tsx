import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef, useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { DataRenderer } from "./data-renderer";
import type { AttributeDescriptor, DataRendererRow, EnumOption, EnumOptionsSource } from "./types";
import { useDataRendererStore } from "./use-data-renderer-store";

const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo", color: "gray" },
        { value: "in_progress", label: "In progress", color: "blue" },
        { value: "done", label: "Done", color: "green" },
      ],
    },
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
    editable: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: { kind: "user" },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "component",
    label: "Component",
    type: {
      kind: "enum",
      options: [
        { value: "backend", label: "Backend", color: "blue" },
        { value: "frontend", label: "Frontend", color: "purple" },
        { value: "devops", label: "DevOps", color: "orange" },
        { value: "docs", label: "Docs", color: "cyan" },
      ],
    },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "priority",
    label: "Priority",
    type: {
      kind: "enum",
      options: [
        { value: "high", label: "High", color: "red" },
        { value: "medium", label: "Medium", color: "yellow" },
        { value: "low", label: "Low", color: "green" },
      ],
    },
    filterable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
  {
    id: "labels",
    label: "Labels",
    type: {
      kind: "enum-multi",
      options: [
        { value: "bug", label: "Bug", color: "red" },
        { value: "regression", label: "Regression", color: "orange" },
        { value: "good-first-issue", label: "Good first issue", color: "green" },
      ],
    },
    filterable: true,
    displayable: true,
  },
];

interface StoryRow extends DataRendererRow {
  attributes: {
    status: string;
    assignee: string;
    component: string;
    priority?: string;
    updated: string;
    labels?: string[];
  };
}

const initialRows: StoryRow[] = [
  {
    id: "1",
    title: "Set up API authentication",
    attributes: {
      status: "todo",
      assignee: "Alex",
      component: "backend",
      priority: "high",
      updated: "2026-03-15T12:00:00.000Z",
      labels: ["bug"],
    },
  },
  {
    id: "2",
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
    id: "3",
    title: "Write docs",
    attributes: { status: "done", assignee: "Taylor", component: "docs", updated: "2026-03-17T12:00:00.000Z" },
  },
  {
    id: "4",
    title: "Design database schema",
    attributes: {
      status: "todo",
      assignee: "Sam",
      component: "backend",
      priority: "medium",
      updated: "2026-03-14T10:00:00.000Z",
    },
  },
  {
    id: "5",
    title: "Implement search filters",
    attributes: {
      status: "in_progress",
      assignee: "Alex",
      component: "frontend",
      priority: "high",
      updated: "2026-03-18T08:00:00.000Z",
      labels: ["regression"],
    },
  },
  {
    id: "6",
    title: "Set up CI pipeline",
    attributes: { status: "done", assignee: "Jordan", component: "devops", updated: "2026-03-13T14:00:00.000Z" },
  },
  {
    id: "7",
    title: "Add error tracking integration",
    attributes: {
      status: "todo",
      assignee: "Jordan",
      component: "backend",
      priority: "low",
      updated: "2026-03-12T09:00:00.000Z",
    },
  },
  {
    id: "8",
    title: "Create onboarding flow",
    attributes: {
      status: "in_progress",
      assignee: "Taylor",
      component: "frontend",
      priority: "high",
      updated: "2026-03-19T11:00:00.000Z",
      labels: ["good-first-issue"],
    },
  },
];

const meta: Meta<typeof DataRenderer> = {
  title: "Patterns/Data Renderer/Data Renderer",
  component: DataRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const STORYBOOK_STORAGE_KEY = "storybook-data-renderer";

const reorderRows = (items: StoryRow[], rowId: string, beforeRowId?: string) => {
  const currentIndex = items.findIndex((row) => row.id === rowId);
  if (currentIndex === -1) return items;

  const next = [...items];
  const [moved] = next.splice(currentIndex, 1);
  if (!moved) return items;

  if (!beforeRowId) {
    next.push(moved);
    return next;
  }

  const beforeIndex = next.findIndex((row) => row.id === beforeRowId);
  if (beforeIndex === -1) {
    next.push(moved);
    return next;
  }

  next.splice(beforeIndex, 0, moved);
  return next;
};

const Wrapper = (props: { emptyState?: boolean; columnGrouping?: string; rowGrouping?: string }) => {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [rows, setRows] = useState<StoryRow[]>(initialRows);
  const reset = useDataRendererStore(STORYBOOK_STORAGE_KEY, (state) => state.reset);
  const setColumnGrouping = useDataRendererStore(STORYBOOK_STORAGE_KEY, (state) => state.setColumnGrouping);
  const setRowGrouping = useDataRendererStore(STORYBOOK_STORAGE_KEY, (state) => state.setRowGrouping);

  useEffect(() => {
    reset();
    setColumnGrouping(props.columnGrouping ?? "status");
    setRowGrouping(props.rowGrouping ?? "none");
  }, [props.columnGrouping, props.rowGrouping, reset, setColumnGrouping, setRowGrouping]);

  const handleAttributeChange = (rowId: string, attributeId: string, value: unknown) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
      ),
    );
  };

  const handleReorder = (rowId: string, beforeRowId?: string) =>
    setRows((current) => reorderRows(current, rowId, beforeRowId) as StoryRow[]);

  return (
    <Box p="sm" height="560px">
      <DataRenderer<StoryRow>
        rows={props.emptyState ? [] : rows}
        storageKey={STORYBOOK_STORAGE_KEY}
        attributes={attributes}
        selectedRowId={selectedRowId}
        onRowClick={(row) => setSelectedRowId(row.id)}
        onAttributeChange={handleAttributeChange}
        onReorder={handleReorder}
        getBoardColumnConfig={(groupKey) => ({
          color: groupKey === "done" ? "green" : groupKey === "in_progress" ? "blue" : "gray",
          canDragIn: true,
          canDragOut: true,
          canCreate: false,
        })}
      />
    </Box>
  );
};

export const BoardView: Story = {
  render: () => <Wrapper />,
};

export const EmptyState: Story = {
  render: () => <Wrapper emptyState />,
};

const switchToListView = async (canvas: ReturnType<typeof within>) => {
  await userEvent.click(canvas.getByLabelText("Display settings"));
  await userEvent.click(within(document.body).getByText("List"));
};

export const SwitchView: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchToListView(canvas);
    await expect(canvas.getByText("Set up API authentication")).toBeInTheDocument();
  },
};

export const DragAndDrop: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const doneColumn = canvas.getByTestId("board-column-done");
    await expect(within(doneColumn).getByText("Write docs")).toBeInTheDocument();

    const card = canvas.getByText("Write docs").closest("[draggable]")!;
    const todoColumn = canvas.getByTestId("board-column-todo");

    const dataTransfer = new DataTransfer();
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(todoColumn, { dataTransfer });
    fireEvent.drop(todoColumn, { dataTransfer });
    fireEvent.dragEnd(card, { dataTransfer });

    await expect(within(canvas.getByTestId("board-column-todo")).getByText("Write docs")).toBeInTheDocument();
    await expect(within(canvas.getByTestId("board-column-done")).queryByText("Write docs")).not.toBeInTheDocument();
  },
};

export const EmptyColumnPersists: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const dragCard = (title: string, targetTestId: string) => {
      const card = canvas.getByText(title).closest("[draggable]")!;
      const target = canvas.getByTestId(targetTestId);
      const dataTransfer = new DataTransfer();
      fireEvent.dragStart(card, { dataTransfer });
      fireEvent.dragOver(target, { dataTransfer });
      fireEvent.drop(target, { dataTransfer });
      fireEvent.dragEnd(card, { dataTransfer });
    };

    dragCard("Write docs", "board-column-todo");
    dragCard("Set up CI pipeline", "board-column-todo");

    await expect(canvas.getByTestId("board-column-done")).toBeInTheDocument();
  },
};

export const MultiValuedLabels: Story = {
  render: () => <Wrapper />,
};

interface CustomRendererRow extends DataRendererRow {
  attributes: StoryRow["attributes"] & { diffOverview: string };
}

const customRendererRows: CustomRendererRow[] = initialRows.slice(0, 4).map((row, index) => {
  const additions = [18, 4, 0, 27][index]!;
  const deletions = [3, 12, 0, 8][index]!;

  return {
    ...row,
    attributes: {
      ...row.attributes,
      diffOverview: `+${additions} -${deletions}`,
    },
  };
});

const customRendererAttributes: AttributeDescriptor[] = [
  ...attributes,
  {
    id: "diffOverview",
    label: "Diff",
    type: { kind: "string" },
    displayable: true,
    render: (value) => (
      <Badge variant="surface" colorPalette="green" textStyle="label/XS/medium">
        {String(value)}
      </Badge>
    ),
  },
];

export const CustomAttributeRenderer: Story = {
  render: () => (
    <Box p="sm" height="560px">
      <DataRenderer<CustomRendererRow>
        rows={customRendererRows}
        storageKey="storybook-data-renderer-custom-attribute"
        attributes={customRendererAttributes}
        defaultSettings={{
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "updated", direction: "desc" },
          displayProperties: ["diffOverview", "status"],
        }}
      />
    </Box>
  ),
};

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
    const updated: EnumOption = { ...last, label: `${last.label} ✦` };
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
  render: () => <LiveWrapper />,
};
