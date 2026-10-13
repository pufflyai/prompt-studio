import type { ControlValueMap } from "@pstdio/sdk/extensions";

export const mergeControlDraft = (draft: ControlValueMap, saved: ControlValueMap, changed: Record<string, number>) => {
  const values = { ...saved };
  for (const id of Object.keys(changed)) {
    if (id in draft) values[id] = draft[id];
  }
  return values;
};
