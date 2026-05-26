export interface StatusOptionEditorItem {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  actions?: string[];
  icon?: string | null;
  isDefault?: boolean;
  isNew?: boolean;
}

export interface StatusOptionEditorAction {
  value: string;
  label: string;
}

export interface StatusOptionEditorProps {
  title: string;
  description?: string;
  items: StatusOptionEditorItem[];
  onItemsChange: (items: StatusOptionEditorItem[]) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  onDeleteItem?: (item: StatusOptionEditorItem) => void;
  onSetDefault?: (item: StatusOptionEditorItem) => void;
  hasChanges?: boolean;
  isSaving?: boolean;
  addLabel?: string;
  addPlaceholder?: string;
  actionOptions?: StatusOptionEditorAction[];
  actionsColumnLabel?: string;
  cancelLabel?: string;
  defaultAddColor?: string;
  defaultColumnLabel?: string;
  deleteButtonText?: string;
  deleteHeadline?: string;
  deleteNotificationText?: (item: StatusOptionEditorItem) => string;
  saveLabel?: string;
  showDefault?: boolean;
  showIcons?: boolean;
}
