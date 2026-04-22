import type { RefObject } from "react";

export type RowData = Record<string, unknown>;

export interface DataTableProps {
  data: RowData[];
  isReadOnly?: boolean;
  fullWidth?: boolean;
  noBorder?: boolean;
  hiddenColumns?: string[];
}

export interface CodeEditorProps {
  language?: string;
  defaultCode?: string;
  isEditable?: boolean;
  showLineNumbers?: boolean;
  disableScroll?: boolean;
  onChange?: (value: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}
