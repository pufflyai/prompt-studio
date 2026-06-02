import type { IconColorPickerIconOption } from "../icon-color-picker";

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
  title: string;
  description?: string;
  values: TagEditorValue[];
  onValuesChange: (values: TagEditorValue[]) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  onDeleteValue?: (value: TagEditorValue) => void;
  onSetDefault?: (value: TagEditorValue) => void;
  hasChanges?: boolean;
  isSaving?: boolean;
  addLabel?: string;
  addPlaceholder?: string;
  actionOptions?: TagEditorAction[];
  actionsColumnLabel?: string;
  cancelLabel?: string;
  defaultAddColor?: string;
  defaultAddIcon?: string | null;
  defaultColumnLabel?: string;
  deleteButtonText?: string;
  deleteHeadline?: string;
  deleteNotificationText?: (value: TagEditorValue) => string;
  colorOptions?: readonly string[];
  iconOptions?: readonly IconColorPickerIconOption[];
  saveLabel?: string;
  showDefault?: boolean;
  showIcons?: boolean;
  valueColumnLabel?: string;
}
