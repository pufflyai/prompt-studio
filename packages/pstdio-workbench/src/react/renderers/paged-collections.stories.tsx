import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CollectionPageRequest } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench, type DataTableRendererQueryContext } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";

const sortDirection = (input: DataTableRendererQueryContext) => (input.sorts[0]?.direction === "desc" ? -1 : 1);

const pageOffset = (page: CollectionPageRequest) => (page.cursor === undefined ? page.offset : Number(page.cursor));

const createFixture = (initiallyHeld: boolean) => {
  const workbench = createWorkbench();
  let held = initiallyHeld;
  let pending = Promise.withResolvers<void>();
  let revision = 0;
  let empty = false;
  const listeners = new Set<() => void>();
  const rows = Array.from({ length: 250 }, (_, index) => ({
    id: `row-${index}`,
    values: { title: `Row ${String(index).padStart(3, "0")}`, rank: index, status: index % 2 ? "Done" : "Todo" },
  }));
  const invalidate = () => {
    revision++;
    for (const listener of listeners) listener();
  };
  workbench.registerModule({
    id: "paged-story",
    activate(ctx) {
      ctx.views.registerView({
        id: "paged-table",
        title: "Paged rows",
        body: {
          kind: "dataTable",
          queryMode: "paged",
          initialPageSize: 100,
          columns: [
            { id: "title", label: "Title", type: "string" },
            { id: "rank", label: "Rank", type: "number" },
            { id: "status", label: "Status", type: "string", groupable: true },
          ],
          defaultSettings: { showStats: false },
          defaultSorts: [{ attributeId: "rank", direction: "asc" }],
          selectionMode: "multiple",
          selectionActions: [{ id: "selected", label: "Use selected rows", run: () => {} }],
          subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          executeQuery: async (input: DataTableRendererQueryContext, signal: AbortSignal) => {
            if (held) await pending.promise;
            signal.throwIfAborted();
            const page = input.page as CollectionPageRequest;
            if (page.revision !== undefined && page.revision !== String(revision)) throw new Error("Stale revision");
            let matching = empty
              ? []
              : rows.filter((row) => row.values.title.toLowerCase().includes(page.search.toLowerCase()));
            for (const rule of input.filter.rules)
              matching = matching.filter((row) =>
                String(row.values[rule.attributeId as keyof typeof row.values]).includes(String(rule.value ?? "")),
              );
            const direction = sortDirection(input);
            matching.sort((a, b) => direction * (a.values.rank - b.values.rank));
            const offset = pageOffset(page);
            const selected = matching.slice(offset, offset + page.limit);
            return {
              rows: selected,
              page: {
                revision: String(revision),
                cursor: offset + page.limit < matching.length ? String(offset + page.limit) : null,
                total: empty ? 0 : rows.length,
                filteredTotal: matching.length,
                groups: ["Done", "Todo"].map((value) => ({
                  field: "status",
                  value,
                  count: matching.filter((row) => row.values.status === value).length,
                })),
              },
            };
          },
        },
      });
      ctx.shellPlacements.registerPlacement({
        id: "paged-table",
        region: "main",
        item: { kind: "view", presence: "fixed", view: { kind: "view", id: "paged-table" } },
      });
    },
  });
  return {
    workbench,
    hold: () => {
      held = true;
      pending = Promise.withResolvers<void>();
    },
    release: () => {
      held = false;
      pending.resolve();
    },
    refresh: () => invalidate(),
    move: () => {
      rows[0]!.values.rank = 300;
      invalidate();
    },
    empty: () => {
      empty = !empty;
      invalidate();
    },
  };
};

const PagedCollections = (props: { initiallyHeld?: boolean }) => {
  const [fixture] = useState(() => createFixture(Boolean(props.initiallyHeld)));
  return (
    <WorkbenchThemeProvider>
      <Stack h="100dvh" gap="sm">
        <Stack direction="row" p="sm">
          <Button onClick={fixture.hold}>Hold next read</Button>
          <Button onClick={fixture.release}>Finish read</Button>
          <Button onClick={fixture.refresh}>Refresh rows</Button>
          <Button onClick={fixture.move}>Move first row</Button>
          <Button onClick={fixture.empty}>Toggle empty results</Button>
        </Stack>
        <Text px="sm">Only the requested 100 rows reach the table. Existing rows stay visible while refreshing.</Text>
        <Box flex="1" minH="0">
          <Workbench workbench={fixture.workbench} />
        </Box>
      </Stack>
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Paged collections",
  component: PagedCollections,
  tags: ["!manifest"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PagedCollections>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = {
  args: { initiallyHeld: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Finish read" }));
    await expect(await canvas.findByText("Row 000")).toBeVisible();
  },
};
export const RefreshAndPageBoundary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Row 000");
    await userEvent.click(canvas.getByRole("button", { name: "Go to next page" }));
    await canvas.findByText("Row 100");
    await userEvent.click(canvas.getByRole("button", { name: "Hold next read" }));
    await userEvent.click(canvas.getByRole("button", { name: "Move first row" }));
    await expect(canvas.getByText("Row 100")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Finish read" }));
    await expect(await canvas.findByText("Row 001")).toBeVisible();
    await expect(canvas.queryByText("Row 000")).not.toBeInTheDocument();
  },
};
export const EmptyResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Row 000");
    await userEvent.click(canvas.getByRole("button", { name: "Toggle empty results" }));
    await expect(await canvas.findByText("No rows")).toBeVisible();
  },
};
export const FiltersAndSorts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Row 000");
    await userEvent.click(canvas.getByRole("button", { name: "Search this view" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search this view" }), "Row 24");
    await expect(await canvas.findByText("Row 240")).toBeVisible();
    await expect(canvas.queryByText("Row 000")).not.toBeInTheDocument();
    const rank = canvas.getByRole("columnheader", { name: /Rank/ });
    await userEvent.click(within(rank).getByRole("button", { name: "Sorted asc" }));
    await userEvent.click(within(document.body).getByText("Sort descending", { exact: true }));
    await expect(await canvas.findByText("Row 249")).toBeVisible();
  },
};

export const RapidNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Row 000");
    await userEvent.click(canvas.getByRole("button", { name: "Hold next read" }));
    await userEvent.click(canvas.getByRole("button", { name: "Go to next page" }));
    await expect(canvas.getByRole("spinbutton")).toHaveValue("1");
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading page 2");
    await expect(canvas.getByText("Row 000")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Go to next page" }));
    await userEvent.click(canvas.getByRole("button", { name: "Finish read" }));
    await expect(await canvas.findByText("Row 200")).toBeVisible();
    await expect(canvas.queryByText("Row 100")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Go to first page" }));
    await expect(await canvas.findByText("Row 000")).toBeVisible();
  },
};

export const SearchStartsFromFirstPage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Row 000");
    await userEvent.click(canvas.getByRole("button", { name: "Go to next page" }));
    await canvas.findByText("Row 100");
    await userEvent.click(canvas.getByRole("button", { name: "Search this view" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search this view" }), "Row 24");
    await canvas.findByText("Row 240");
    await userEvent.click(canvas.getByRole("button", { name: "Close search" }));
    await expect(await canvas.findByText("Row 000")).toBeVisible();
    await expect(canvas.getByRole("spinbutton")).toHaveValue("1");
  },
};
