import type { Localizable } from "../l10n";
import type { EventRef } from "./events";

/** A raw cross-extension id must be namespaced. Local events use an EventRef. */
export type RendererEventReference = EventRef | `${string}.${string}`;

export interface RendererContributionBase {
  title: Localizable<string>;
  icon?: string;
  resourceKind?: string;
  refreshEvents?: readonly RendererEventReference[];
  emptyTitle?: Localizable<string>;
  emptyDescription?: Localizable<string>;
}
