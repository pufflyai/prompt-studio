import type { ReactNode } from "react";
import type { IconColorPickerIconOption } from "@/components/primitives/icon-options";

export interface TagEditorValue {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  actions?: string[];
  icon?: string | null;
  isDefault?: boolean;
  isNew?: boolean;
}

export interface TagEditorAction {
  value: string;
  label: string;
  /** Rendered before the label in the trigger and the menu row. */
  icon?: ReactNode;
}

export interface TagEditorProps {
  values: TagEditorValue[];
  onValuesChange: (values: TagEditorValue[]) => void;
  onDeleteValue?: (value: TagEditorValue) => void;
  onSetDefault?: (value: TagEditorValue) => void;
  /** Enables inline renaming of the tag definition itself. */
  onTitleChange?: (title: string) => void;
  title?: string;
  description?: string;
  /** Rendered on the right of the header row, e.g. a mode toggle and a delete action. */
  headerActions?: ReactNode;
  /** Marks the heading with the unsaved-changes asterisk. */
  hasChanges?: boolean;
  isSaving?: boolean;
  readOnly?: boolean;
  addLabel?: string;
  /** Name given to a freshly added option before it is renamed inline. */
  addName?: string;
  actionOptions?: TagEditorAction[];
  /** Names the per-row action control, e.g. "Commands". Used in its label and aria-label. */
  actionsLabel?: string;
  /** Names the default-value control shown under the list when showDefault is set. */
  defaultValueLabel?: string;
  defaultAddColor?: string;
  defaultAddIcon?: string | null;
  deleteButtonText?: string;
  deleteHeadline?: string;
  deleteNotificationText?: (value: TagEditorValue) => string;
  colorOptions?: readonly string[];
  iconOptions?: readonly IconColorPickerIconOption[];
  showDefault?: boolean;
  showIcons?: boolean;
  /** Draws the list as a bordered card, so the header and footer bands read as one panel. */
  framed?: boolean;
  /** Renders a column header band above the rows. Needs `framed` to look right. */
  showColumnHeaders?: boolean;
  /** Header label above the option names, e.g. "State". */
  valueColumnLabel?: string;
}
