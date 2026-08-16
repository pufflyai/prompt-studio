export type MarkdownTableAlignment = "left" | "center" | "right" | null;

export interface MarkdownTableColumn {
  id: string;
  label: string;
  alignment: MarkdownTableAlignment;
}

export interface MarkdownTableRow {
  id: string;
  cells: Record<string, string>;
}

export interface MarkdownTableValue {
  columns: MarkdownTableColumn[];
  rows: MarkdownTableRow[];
}

export const updateMarkdownTableColumn = (
  table: MarkdownTableValue,
  columnId: string,
  update: Partial<Pick<MarkdownTableColumn, "label" | "alignment">>,
) => ({
  ...table,
  columns: table.columns.map((column) => (column.id === columnId ? { ...column, ...update } : column)),
});

export const updateMarkdownTableCell = (table: MarkdownTableValue, rowId: string, columnId: string, value: string) => ({
  ...table,
  rows: table.rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          cells: { ...row.cells, [columnId]: value },
        }
      : row,
  ),
});

export const addMarkdownTableColumn = (table: MarkdownTableValue, column: MarkdownTableColumn) => ({
  columns: [...table.columns, column],
  rows: table.rows.map((row) => ({
    ...row,
    cells: { ...row.cells, [column.id]: "" },
  })),
});

export const removeMarkdownTableColumn = (table: MarkdownTableValue, columnId: string) => {
  if (table.columns.length === 1 || !table.columns.some((column) => column.id === columnId)) return table;

  return {
    columns: table.columns.filter((column) => column.id !== columnId),
    rows: table.rows.map((row) => ({
      ...row,
      cells: Object.fromEntries(Object.entries(row.cells).filter(([key]) => key !== columnId)),
    })),
  };
};

export const addMarkdownTableRow = (table: MarkdownTableValue, row: MarkdownTableRow) => ({
  ...table,
  rows: [
    ...table.rows,
    {
      ...row,
      cells: Object.fromEntries(table.columns.map((column) => [column.id, row.cells[column.id] ?? ""])),
    },
  ],
});

export const removeMarkdownTableRow = (table: MarkdownTableValue, rowId: string) => ({
  ...table,
  rows: table.rows.filter((row) => row.id !== rowId),
});

export const createEmptyMarkdownTable = (id: string): MarkdownTableValue => ({
  columns: [
    { id: `${id}-column-1`, label: "Column 1", alignment: null },
    { id: `${id}-column-2`, label: "Column 2", alignment: null },
  ],
  rows: [
    {
      id: `${id}-row-1`,
      cells: {
        [`${id}-column-1`]: "",
        [`${id}-column-2`]: "",
      },
    },
  ],
});
