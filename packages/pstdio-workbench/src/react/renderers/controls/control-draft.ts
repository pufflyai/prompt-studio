import type { ControlValueMap } from "@pstdio/sdk/extensions";

export const mergeControlDraft = (
  draft: ControlValueMap,
  saved: ControlValueMap,
  changed: Record<string, true>,
  explicitApply: boolean,
) => {
  const values = { ...saved };
  if (explicitApply)
    for (const id of Object.keys(changed)) {
      if (id in draft) values[id] = draft[id];
    }
  return values;
};
