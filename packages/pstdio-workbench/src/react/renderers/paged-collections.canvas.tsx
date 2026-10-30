import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { CollectionPageRequest } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { createWorkbench, type DataTableRendererQueryContext } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";

const sortDirection = (input: DataTableRendererQueryContext) => (input.sorts[0]?.direction === "desc" ? -1 : 1);
const pageOffset = (page: CollectionPageRequest) => (page.cursor === undefined ? page.offset : Number(page.cursor));
const createFixture = (initiallyHeld: boolean, withOtherTable: boolean) => {
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
      if (withOtherTable) {
        ctx.views.registerView({
          id: "other-table",
          title: "Other table",
          body: {
            kind: "dataTable",
            columns: [{ id: "title", label: "Title" }],
            defaultSettings: { showStats: false },
            executeQuery: () => ({ rows: [{ id: "other", values: { title: "Another collection" } }] }),
          },
        });
        ctx.shellPlacements.registerPlacement({
          id: "other-table",
          region: "main",
          item: { kind: "view", presence: "fixed", view: { kind: "view", id: "other-table" } },
        });
      }
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
const PagedCollections = (props: { initiallyHeld?: boolean; withOtherTable?: boolean }) => {
  const [fixture] = useState(() => createFixture(Boolean(props.initiallyHeld), Boolean(props.withOtherTable)));
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
  fullscreen: true,
} satisfies CanvasMeta<typeof PagedCollections>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const HiddenPageState: Story = {
  id: "pstdio-workbench-guides-paged-collections--hidden-page-state",
  args: { withOtherTable: true },
};
export const Loading: Story = {
  id: "pstdio-workbench-guides-paged-collections--loading",
  args: { initiallyHeld: true },
};
export const RefreshAndPageBoundary: Story = {
  id: "pstdio-workbench-guides-paged-collections--refresh-and-page-boundary",
};
export const EmptyResults: Story = {
  id: "pstdio-workbench-guides-paged-collections--empty-results",
};
export const FiltersAndSorts: Story = {
  id: "pstdio-workbench-guides-paged-collections--filters-and-sorts",
};
export const RapidNavigation: Story = {
  id: "pstdio-workbench-guides-paged-collections--rapid-navigation",
};
export const SearchStartsFromFirstPage: Story = {
  id: "pstdio-workbench-guides-paged-collections--search-starts-from-first-page",
};
