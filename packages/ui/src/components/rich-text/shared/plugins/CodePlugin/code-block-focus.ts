let pendingFocusedCodeBlockKey: null | string = null;

export function queueCodeBlockFocus(nodeKey: string) {
  pendingFocusedCodeBlockKey = nodeKey;
}

export function consumeCodeBlockFocus(nodeKey: string) {
  if (pendingFocusedCodeBlockKey !== nodeKey) {
    return false;
  }

  pendingFocusedCodeBlockKey = null;
  return true;
}
