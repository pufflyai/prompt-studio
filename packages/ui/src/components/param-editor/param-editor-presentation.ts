import type { Param } from "./param-editor.types";

export const isParamEditorRichControl = (param: Param) =>
  param.type === "fileUpload" || (param.type === "text" && param.singleLine === false);

export const isParamEditorHorizontalControl = (param: Param) => param.type !== "anchorGrid";
