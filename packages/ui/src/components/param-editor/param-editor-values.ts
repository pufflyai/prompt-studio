import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";

/** Controls and their dependants read the same defaults, including grouped fields. */
export const resolveParamEditorValues = (params: Param[], groups: InputGroup[], values: ParamValueMap = {}) => {
  const defaults: Record<string, ParamValue> = {};
  for (const param of [...params, ...groups.flatMap((group) => group.params)])
    if ("defaultValue" in param && param.defaultValue !== undefined) defaults[param.id] = param.defaultValue;
  return { ...defaults, ...values };
};
