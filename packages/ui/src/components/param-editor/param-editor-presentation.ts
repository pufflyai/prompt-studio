import type { Param } from "./param-editor.types";

export const isParamEditorRichControl = (param: Param) => param.type === "fileUpload";

export const isParamEditorHorizontalControl = (param: Param) => param.type !== "anchorGrid";
