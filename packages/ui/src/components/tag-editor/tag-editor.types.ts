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
  addLabel?: string;
  /** Name given to a freshly added option before it is renamed inline. */
  addName?: string;
  actionOptions?: TagEditorAction[];
  defaultAddColor?: string;
  defaultAddIcon?: string | null;
  deleteButtonText?: string;
  deleteHeadline?: string;
  deleteNotificationText?: (value: TagEditorValue) => string;
  colorOptions?: readonly string[];
  iconOptions?: readonly IconColorPickerIconOption[];
  showDefault?: boolean;
  showIcons?: boolean;
}
