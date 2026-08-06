interface DialogAcceptShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

export const handleDialogAcceptShortcut = (event: DialogAcceptShortcutEvent, accept: () => void, enabled = true) => {
  if (!enabled || event.defaultPrevented) return;
  if (event.key !== "Enter") return;
  if ((!event.ctrlKey && !event.metaKey) || event.shiftKey || event.altKey) return;

  event.preventDefault();
  event.stopPropagation();
  accept();
};
