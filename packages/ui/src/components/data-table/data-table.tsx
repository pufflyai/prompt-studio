import "./data-table.css";

import { Flex } from "@chakra-ui/react";
import { getCoreRowModel, type RowSelectionState, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { CollectionViewEmptyState } from "../collection-view/collection-view-empty-state";
import { findField } from "../collection-view/collection-view-fields";
import { countFilterRules } from "../collection-view/collection-view-filter";
import { buildColumns } from "./build-columns";
import { DataTableDisplayMenu } from "./data-table-display-menu";
import { DataTableGrid } from "./data-table-grid";
import { pageGroupedRows, pageRows } from "./data-table-grouping";
import { DataTableHeader } from "./data-table-header";
import {
  reorderDataTableColumns,
  resolveInitialPageSize,
  resolveSelectionActions,
  shouldEnableSelection,
  toggleHiddenDataTableColumn,
} from "./data-table-state";
import type { DataTableFieldMenu } from "./data-table-table-parts";
import { EditModeDataTable } from "./edit-mode-data-table";
import { PaginationFooter } from "./pagination-footer";
import type { DataTableProps } from "./types";
import { useDataTableView } from "./use-data-table-view";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const DatasetDataTable = (props: DataTableProps) => {
  const {
    noBorder,
    fullWidth,
    onRowClick,
    isRowInteractive,
    activeRowId,
    columnIcons,
    columnDescriptions,
    compactHeaders,
    columnStats,
    columnRenderers,
    initialPageSize,
    pageSizeOptions = [10, 20, 30, 50, 100],
    rowActions = [],
    getRowActions,
    enableRowActivation = false,
    getCellContextMenuActions,
  } = props;
  const view = useDataTableView(props);
  const { settings, setSettings, sorts, setSorts, filter, startRule, setOpenMenu } = view;
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(() => resolveInitialPageSize({ initialPageSize }));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const enableSelection = shouldEnableSelection(props);
  const selectionActions = resolveSelectionActions(props);
  const { groups } = view;
  // Collapsed groups give their rows back to the pages.
  const shownRows = groups ? groups.flatMap((group) => (collapsed.has(group.key) ? [] : group.rows)) : view.shownRows;
  const page = groups
    ? pageGroupedRows(groups, collapsed, pageIndex, pageSize)
    : pageRows(shownRows, pageIndex, pageSize);
  const data = shownRows.map((row) => row.sourceRow);
  const idBySource = new Map(shownRows.map((row) => [row.sourceRow, row.id]));
  const columns = buildColumns(data, view.visibleColumnKeys, {
    columnIcons,
    columnDescriptions,
    compactHeaders,
    enableSelection,
    rowActions,
    getRowActions,
    selectedRowIds: rowSelection,
    columnRenderers,
    wrapRows: settings.wrapRows,
    rowNumbers: settings.rowNumbers,
    search: view.deferredSearch,
  });

  const table = useReactTable({
    data,
    columns,
    defaultColumn: { size: 150, minSize: 40, maxSize: 800 },
    state: { rowSelection },
    getRowId: (row) => idBySource.get(row) ?? "",
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableMultiRowSelection: enableSelection,
    enableRowSelection: enableSelection,
    autoResetAll: false,
  });

  const fieldMenu: DataTableFieldMenu = {
    sortFor: (columnId) => {
      const level = sorts.findIndex((sort) => sort.attributeId === columnId);
      return level === -1 ? undefined : { direction: sorts[level]!.direction, level: level + 1 };
    },
    sortLevels: sorts.length,
    // The header replaces all sorts with this column; the Sort menu builds several levels.
    onSort: (columnId, direction) => setSorts([{ attributeId: columnId, direction }]),
    onFilterBy: (columnId) => {
      const field = findField(view.attributes, columnId);
      if (field) startRule(field);
    },
    onHide: (columnId) =>
      setSettings({ hiddenColumns: toggleHiddenDataTableColumn(settings.hiddenColumns, columnId, false) }),
  };

  const total = view.rows.length;
  const hiddenByFilter = total - view.filteredRows.length;
  const summary = [
    page.shownCount === total ? plural(total, "row") : `${page.shownCount} of ${plural(total, "row")}`,
    groups ? plural(groups.length, "group") : undefined,
    hiddenByFilter > 0 ? `${hiddenByFilter} hidden by the view's filter` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const showFooter = page.pageCount > 1 || page.shownCount !== total || Boolean(groups);
  const nothingShown = total > 0 && view.shownRows.length === 0;

  return (
    <Flex direction="column" height="100%" width="100%">
      <DataTableHeader
        view={view}
        viewsSource={props.viewsSource}
        actions={props.toolbarActions}
        displayControl={
          <DataTableDisplayMenu
            columns={view.attributes}
            settings={settings}
            statsAvailable={Boolean(columnStats)}
            onSettingsChange={setSettings}
            onColumnVisibilityChange={(columnId, visible) =>
              setSettings({ hiddenColumns: toggleHiddenDataTableColumn(settings.hiddenColumns, columnId, visible) })
            }
            onColumnReorder={(activeColumnId, overColumnId) =>
              setSettings({
                columnOrder: reorderDataTableColumns(view.orderedColumnKeys, activeColumnId, overColumnId),
              })
            }
          />
        }
      />
      {props.contentPlaceholder ??
        (nothingShown ? (
          <CollectionViewEmptyState
            search={view.deferredSearch}
            ruleCount={countFilterRules(filter)}
            hiddenCount={total}
            onClearSearch={() => view.setSearch("")}
            onEditFilter={() => setOpenMenu("advanced")}
          />
        ) : (
          <DataTableGrid
            table={table}
            entries={page.entries}
            collapsed={collapsed}
            onToggleGroup={(key) =>
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            settings={settings}
            data={data}
            fieldMenu={fieldMenu}
            selectionActions={enableSelection ? selectionActions : undefined}
            noBorder={noBorder}
            fullWidth={fullWidth}
            onRowClick={onRowClick}
            isRowInteractive={isRowInteractive}
            activeRowId={activeRowId}
            columnDescriptions={columnDescriptions}
            columnStats={columnStats}
            enableRowActivation={enableRowActivation}
            getCellContextMenuActions={getCellContextMenuActions}
          />
        ))}
      {showFooter ? (
        <PaginationFooter
          pageCount={page.pageCount}
          pageIndex={page.page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          summary={summary}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
        />
      ) : null}
    </Flex>
  );
};

export const DataTable = (props: DataTableProps) => {
  if (props.editMode) return <EditModeDataTable {...props} />;
  return <DatasetDataTable {...props} />;
};
