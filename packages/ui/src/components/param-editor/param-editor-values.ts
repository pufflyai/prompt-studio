import { useState } from "react";
import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";

/** Controls and their dependants read the same defaults, including grouped fields. */
export const resolveParamEditorValues = (params: Param[], groups: InputGroup[], values: ParamValueMap = {}) => {
  const defaults: Record<string, ParamValue> = {};
  for (const param of [...params, ...groups.flatMap((group) => group.params)])
    if ("defaultValue" in param && param.defaultValue !== undefined) defaults[param.id] = param.defaultValue;
  return { ...defaults, ...values };
};

export const useParamEditorValues = (
  params: Param[],
  groups: InputGroup[],
  defaults: ParamValueMap,
  notify?: (id: string, value: ParamValue) => void,
) => {
  const resolved = resolveParamEditorValues(params, groups, defaults);
  const [state, setState] = useState({ defaults: resolved, values: resolved });
  let values = state.values;
  if (JSON.stringify(state.defaults) !== JSON.stringify(resolved)) {
    values = { ...resolved };
    for (const [id, value] of Object.entries(state.values))
      if (id in resolved && JSON.stringify(state.defaults[id]) === JSON.stringify(resolved[id])) values[id] = value;
    setState({ defaults: resolved, values });
  }
  return {
    values,
    onChange: (id: string, value: ParamValue) => {
      setState((current) => ({ ...current, values: { ...current.values, [id]: value } }));
      notify?.(id, value);
    },
  };
};
