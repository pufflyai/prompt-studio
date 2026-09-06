import { isRecord } from "./accumulator";

const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";

const isTab = (value: unknown) =>
  value === undefined ||
  (isRecord(value) &&
    typeof value.query === "function" &&
    (value.refreshEvents === undefined || Array.isArray(value.refreshEvents)));

export const isPlacementPresentation = (value: unknown) => {
  if (!isRecord(value)) return false;
  return (
    (value.mountStrategy === undefined || value.mountStrategy === "active" || value.mountStrategy === "keep-mounted") &&
    isOptionalBoolean(value.hiddenByDefault) &&
    isOptionalBoolean(value.headerBorderBottom) &&
    isTab(value.tab)
  );
};

const removedPresentationFields: Record<string, string> = {
  openCommand: 'declare an "add" action on the resource binding instead',
  regionCollapsible: 'declare "regionSettings" on the owning mode instead',
  regionSize: 'declare "regionSettings" on the owning mode instead',
};

const removedLifecycleFields: Record<string, string> = {
  closable: 'declare "presence" on the static item instead',
  defaultOpen: 'declare "presence" on a static item or "openOn" on a bound slot instead',
  defaultResource: 'declare an "add" action on the resource binding instead',
  required: 'declare "presence" on the static item instead',
};

/**
 * Names the first removed alpha.8 field a contribution still declares, with
 * the replacement to use, so validation can fail with a field-specific
 * diagnostic.
 */
export const removedPlacementField = (value: unknown) => {
  if (!isRecord(value)) return undefined;
  for (const [field, replacement] of Object.entries({ ...removedLifecycleFields, ...removedPresentationFields })) {
    if (value[field] !== undefined) return { field, replacement };
  }
  return undefined;
};
