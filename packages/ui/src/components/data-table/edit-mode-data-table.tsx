import { Box, Flex, Table } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { useKanbanRendererStore } from "../kanban-renderer/use-kanban-renderer-store";
import { DataTableHeader } from "./data-table-header";
import {
  buildDataTableRendererAttributes,
  buildDataTableRendererRows,
  filterDataTableRows,
  resolveDataTableToolbarStorageKey,
  resolveSelectionActions,
  shouldEnableSelection,
} from "./data-table-state";
import { EditModeDataTableBody } from "./edit-mode-data-table-body";
import { EditModeDataTableHeader } from "./edit-mode-data-table-header";
import { EditModeSelectionHeader } from "./edit-mode-data-table-selection";
import { PaginationFooter } from "./pagination-footer";
import { SelectionToolbar } from "./selection-toolbar";
import type { DataTableEditModeColumn, DataTableProps, RowData } from "./types";

const createId = (kind: "column" | "row") => {
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${kind}-${unique}`;
};

interface ActiveCell {
  rowId: string;
  columnId: string;
  draft: string;
}

interface ActiveHeader {
  columnId: string;
  draft: string;
}

export const EditModeDataTable = (props: DataTableProps) => {
  const {
    data,
    editMode,
    fullWidth = false,
    initialPageSize = 30,
    pageSizeOptions = [10, 20, 30, 50],
    isReadOnly = true,
    getRowId,
    columnIcons,
    toolbarStorageKey,
    defaultViews,
    defaultActiveViewId,
  } = props;
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(() => Math.min(Math.max(initialPageSize, 1), 50));
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [activeHeader, setActiveHeader] = useState<ActiveHeader | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const columns = editMode?.columns ?? [];
  const columnKeys = columns.map((column) => column.id);
  const columnLabels = Object.fromEntries(columns.map((column) => [column.id, column.label]));
  const rendererAttributes = buildDataTableRendererAttributes(data, columnKeys, columnLabels);
  const rendererRows = buildDataTableRendererRows(data, columnKeys, getRowId);
  const resolvedToolbarStorageKey = resolveDataTableToolbarStorageKey({ toolbarStorageKey, columnKeys });
  const rendererInitialState = {
    settings: { viewMode: "list" as const },
    views: defaultViews,
    activeViewId: defaultActiveViewId,
  };
  const filters = useKanbanRendererStore(resolvedToolbarStorageKey, (state) => state.filters, rendererInitialState);
  const filteredRendererRows = filterDataTableRows(rendererRows, filters, rendererAttributes);
  const filteredData = filteredRendererRows.map((row) => row.sourceRow);
  const cappedPageSizeOptions = [...new Set(pageSizeOptions.filter((option) => option > 0 && option <= 50))];
  const pageCount = Math.max(Math.ceil(filteredData.length / pageSize), 1);
  const pageRows = filteredData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  let tableWidth = "fit-content";
  if (fullWidth) tableWidth = isReadOnly ? "100%" : "calc(100% + var(--chakra-spacing-10))";
  const enableSelection = shouldEnableSelection(props);
  const selectionActions = resolveSelectionActions(props);

  useEffect(() => {
    if (pageIndex < pageCount) return;
    setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex]);

  useEffect(() => {
    const visibleIds = new Set(filteredRendererRows.map((row) => row.id));
    setSelectedRowIds((current) => {
      const next = new Set([...current].filter((rowId) => visibleIds.has(rowId)));
      const isUnchanged = next.size === current.size && [...next].every((rowId) => current.has(rowId));
      return isUnchanged ? current : next;
    });
  }, [filteredRendererRows]);

  if (!editMode) return null;

  const rowIdFor = (row: RowData, index: number) => getRowId?.(row, index) ?? String(row.id ?? index);

  const commitCell = () => {
    if (!activeCell) return;

    editMode.onDataChange(
      data.map((row, index) =>
        rowIdFor(row, index) === activeCell.rowId ? { ...row, [activeCell.columnId]: activeCell.draft } : row,
      ),
    );
    setActiveCell(null);
  };

  const updateColumn = (columnId: string, update: Partial<DataTableEditModeColumn>) => {
    editMode.onColumnsChange(
      columns.map((column) => (column.id === columnId ? { ...column, ...update, id: column.id } : column)),
    );
  };

  const commitHeader = () => {
    if (!activeHeader) return;
    updateColumn(activeHeader.columnId, { label: activeHeader.draft });
    setActiveHeader(null);
  };

  const addColumn = () => {
    const id = createId("column");
    editMode.onColumnsChange([...columns, { id, label: `Column ${columns.length + 1}`, alignment: null }]);
  };

  const removeColumn = (columnId: string) => {
    if (columns.length === 1) return;
    editMode.onColumnsChange(columns.filter((column) => column.id !== columnId));
    if (activeHeader?.columnId === columnId) setActiveHeader(null);
  };

  const addRow = () => {
    const row = Object.fromEntries(columns.map((column) => [column.id, ""]));
    row.id = createId("row");
    editMode.onDataChange([...data, row]);
  };

  const changePageSize = (nextPageSize: number) => {
    setPageSize(Math.min(nextPageSize, 50));
    setPageIndex(0);
  };

  const removeRow = (rowId: string) => {
    editMode.onDataChange(data.filter((row, index) => rowIdFor(row, index) !== rowId));
  };

  const toggleRowSelection = (rowId: string, checked: boolean) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const allRowsSelected = filteredRendererRows.length > 0 && selectedRowIds.size === filteredRendererRows.length;
  const selectedRows = filteredRendererRows.filter((row) => selectedRowIds.has(row.id)).map((row) => row.sourceRow);

  return (
    <Flex direction="column" width="100%" gap="2xs">
      {toolbarStorageKey ? (
        <DataTableHeader
          rows={rendererRows}
          storageKey={resolvedToolbarStorageKey}
          attributes={rendererAttributes}
          columnControl={null}
          defaultViews={defaultViews}
          defaultActiveViewId={defaultActiveViewId}
        />
      ) : null}
      <Box position="relative" width="100%">
        <ScrollArea
          data-table-scroll-area
          maxWidth="100%"
          showHorizontalScrollbar
          showVerticalScrollbar={false}
          viewportProps={{ overflowY: "hidden" }}
        >
          <Table.Root
            data-edit-mode="true"
            size="sm"
            tableLayout="fixed"
            width={tableWidth}
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <colgroup>
              <Box as="col" width="9" />
              {enableSelection ? <Box as="col" width="9" /> : null}
              {columns.map((column) => (
                <col key={column.id} />
              ))}
              {!isReadOnly ? <Box as="col" width="10" /> : null}
            </colgroup>
            <EditModeDataTableHeader
              activeHeader={activeHeader}
              columnIcons={columnIcons}
              columns={columns}
              data={data}
              editMode={editMode}
              isReadOnly={isReadOnly}
              onAddColumn={addColumn}
              onCancelHeaderEdit={() => setActiveHeader(null)}
              onDeleteColumn={removeColumn}
              onHeaderDraftChange={(draft) => setActiveHeader((current) => (current ? { ...current, draft } : current))}
              onHeaderEdit={(column) => setActiveHeader({ columnId: column.id, draft: column.label })}
              onSaveHeader={commitHeader}
              selectionHeader={
                enableSelection ? (
                  <EditModeSelectionHeader
                    checked={allRowsSelected}
                    indeterminate={selectedRowIds.size > 0 && !allRowsSelected}
                    onChange={(checked) =>
                      setSelectedRowIds(checked ? new Set(filteredRendererRows.map((row) => row.id)) : new Set())
                    }
                  />
                ) : undefined
              }
            />
            <EditModeDataTableBody
              activeCell={activeCell}
              columns={columns}
              data={data}
              editMode={editMode}
              enableSelection={enableSelection}
              isReadOnly={isReadOnly}
              pageIndex={pageIndex}
              pageRows={pageRows}
              pageSize={pageSize}
              selectedRowIds={selectedRowIds}
              showNewRow={pageIndex === pageCount - 1}
              onActivateCell={setActiveCell}
              onAddRow={addRow}
              onCancelCell={() => setActiveCell(null)}
              onCommitCell={commitCell}
              onDraftChange={setActiveCell}
              onRemoveRow={removeRow}
              onToggleRowSelection={toggleRowSelection}
              rowIdFor={rowIdFor}
            />
          </Table.Root>
        </ScrollArea>
        {enableSelection && selectedRows.length > 0 ? (
          <SelectionToolbar
            selectedCount={selectedRows.length}
            totalCount={filteredRendererRows.length}
            onClearSelection={() => setSelectedRowIds(new Set())}
            onSelectAll={() => setSelectedRowIds(new Set(filteredRendererRows.map((row) => row.id)))}
            actions={selectionActions}
            selectedRows={selectedRows}
          />
        ) : null}
      </Box>
      {pageCount > 1 ? (
        <PaginationFooter
          pageCount={pageCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageSizeOptions={cappedPageSizeOptions}
          totalRows={filteredData.length}
          onPageChange={setPageIndex}
          onPageSizeChange={changePageSize}
        />
      ) : null}
    </Flex>
  );
};
