export const addPendingActionKey = (pendingActionKeys: string[], actionKey: string) =>
  pendingActionKeys.includes(actionKey) ? pendingActionKeys : [...pendingActionKeys, actionKey];

export const removePendingActionKey = (pendingActionKeys: string[], actionKey: string) =>
  pendingActionKeys.filter((key) => key !== actionKey);
