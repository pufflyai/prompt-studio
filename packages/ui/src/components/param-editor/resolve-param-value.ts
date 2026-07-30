import type { ParamValueMap } from "./param-editor.types";

export const resolveParamValue = <T>(defaultValues: ParamValueMap, paramId: string, fallback: T) =>
  defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
