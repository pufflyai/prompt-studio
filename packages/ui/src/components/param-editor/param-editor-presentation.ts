import type { Param } from "./param-editor.types";

export const isParamEditorRichControl = (param: Param) =>
  param.type === "fileUpload" || (param.type === "text" && param.singleLine === false);

export const isParamEditorHorizontalControl = (param: Param) => param.type !== "anchorGrid";

// Fixed-format values share the label row even in a full-width editor.
export const isParamEditorGrowingControl = (param: Param) => {
  switch (param.type) {
    case "text":
    case "markdown":
    case "fileUpload":
    case "property":
      return true;
    case "resource":
    case "selection":
      return Boolean(param.multiSelect);
    case "readOnly":
      return typeof param.value === "string" || typeof param.value === "object";
    default:
      return false;
  }
};
