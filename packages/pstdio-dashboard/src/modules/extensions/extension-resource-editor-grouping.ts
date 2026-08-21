import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { compositionResourceKinds, type ResourcePanelBinding, resourcePanelBindings } from "./extension-composition";

export interface ResourceEditorGroup {
  kind: string;
  /** Absent for inspector groups: side-only kinds open in place without a main editor. */
  primary?: ResourcePanelBinding;
  companions: ResourcePanelBinding[];
}

// Groups the panels bound to a resource kind by resource-panel edges. The binding the
// mode recipe places in `main` is the editor; the others open alongside it bound to the
// same resource. A kind the recipe places only in the Side Panel forms an inspector
// group: it opens in place without a main editor.
export const groupResourceEditorViews = (
  metadata: DashboardExtensionMetadata,
  options: { modeId?: string; resourceKinds?: readonly string[] } = {},
): ResourceEditorGroup[] =>
  (options.resourceKinds ?? compositionResourceKinds(metadata))
    .map((kind) => {
      const bindings = resourcePanelBindings(metadata, kind, options.modeId);
      const primary = bindings.find((binding) => binding.region === "main");
      if (primary) {
        return { kind, primary, companions: bindings.filter((binding) => binding !== primary) };
      }
      if (!bindings.some((binding) => binding.region === "side")) return undefined;
      return { kind, primary: undefined, companions: bindings };
    })
    .filter((group): group is ResourceEditorGroup => Boolean(group));
