import type { Localizable } from "../l10n";
import type { DockedWorkbenchRegion } from "./composition";
import type { ContributionDefinition, ResourceKindRef, ViewRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { ResourceRef } from "./resources";

// A page is a named composition of the bench: slots place content into regions with a
// per-slot open policy, and bindings say which view presents which resource kind in
// which slot. Tabs are derived from slot content; nothing about presentation persists.

export interface PageSlot {
  readonly id: string;
  readonly region: DockedWorkbenchRegion;
  // Static content. A slot is static (view) or bound (no view + a binding), never both.
  readonly view?: ViewRef;
  // Bound slots only. "one" swaps in place, "many" stacks tabs. Default "one".
  readonly cardinality?: "one" | "many";
  // false protects the tab while the slot has content. Default true.
  readonly closable?: boolean;
  // Static slots only: false starts the slot closed until revealed. Default true.
  readonly defaultOpen?: boolean;
  // Static slots only: how long the view's state lives. "page" shares one state across
  // the page's locations; "location" keys it to the page's active bound instance —
  // the same instance the URL serializes. Default "page".
  readonly scope?: "page" | "location";
  // One-cardinality bound slots only: the id of a `many` slot on this page sharing a
  // bound kind, whose active instance this slot tracks.
  readonly follows?: string;
  // Among slots in the same region. Default declaration order.
  readonly order?: number;
}

export interface PageBinding {
  readonly resourceKind: ResourceKindRef;
  readonly view: ViewRef;
  readonly slot: string;
}

export interface PageContribution extends ContributionDefinition<"page"> {
  readonly title: Localizable<string>;
  readonly icon?: string;
  // URL segment under the extension's namespace: /projects/{project}/{extension-id}/{path}.
  readonly path?: string;
  readonly slots: readonly PageSlot[];
  readonly bindings?: readonly PageBinding[];
}

// What a view body returns from an activation instead of a navigation target. The
// active page's bindings place the resource; the bench holds still.
export interface ResourceEmission {
  readonly resource: ResourceRef;
  readonly open?: "preview" | "pin";
  // Re-target the matching open instance at a section instead of opening a duplicate.
  readonly section?: FileRendererSectionTarget;
}
