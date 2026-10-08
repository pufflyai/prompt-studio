export interface CodeSourcePosition {
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export const sourcePositionSelection = (
  position: CodeSourcePosition,
  model: {
    getLineCount(): number;
    getLineMaxColumn(line: number): number;
  },
) => {
  const clampLine = (line: number) => Math.min(line, model.getLineCount());
  const line = clampLine(position.line);
  const endLine = clampLine(position.endLine ?? position.line);
  const column = Math.min(position.column ?? 1, model.getLineMaxColumn(line));
  const endColumn = Math.min(
    position.endColumn ?? (position.endLine === undefined ? position.column : undefined) ?? 1,
    model.getLineMaxColumn(endLine),
  );
  return {
    startLineNumber: line,
    startColumn: column,
    endLineNumber: endLine,
    endColumn: endLine === line ? Math.max(column, endColumn) : endColumn,
  };
};
