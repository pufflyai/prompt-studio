interface ShouldShowFloatingToolbarParams {
  hasSelection: boolean;
  isRangeSelection: boolean;
  isCollapsed: boolean;
  hasNativeSelection: boolean;
  hasNativeRange: boolean;
  isAnchorInsideEditor: boolean;
  isEditorEditable: boolean;
}

export function shouldShowFloatingToolbar(params: ShouldShowFloatingToolbarParams) {
  const {
    hasSelection,
    isRangeSelection,
    isCollapsed,
    hasNativeSelection,
    hasNativeRange,
    isAnchorInsideEditor,
    isEditorEditable,
  } = params;

  return (
    hasSelection &&
    isRangeSelection &&
    !isCollapsed &&
    hasNativeSelection &&
    hasNativeRange &&
    isAnchorInsideEditor &&
    isEditorEditable
  );
}
