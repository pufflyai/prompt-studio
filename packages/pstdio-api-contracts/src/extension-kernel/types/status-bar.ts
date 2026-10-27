import type { ContributionDefinition, StatusBarSlotRef, ViewRef } from "./contribution-identity";
import type { WhenExpression } from "./contributions";

export interface StatusBarItemContribution extends ContributionDefinition<"status-bar-item"> {
  readonly view: ViewRef;
  /** Detail view opened above this item. The host owns placement outside the status iframe. */
  readonly popover?: ViewRef;
  readonly slot: StatusBarSlotRef;
  readonly order?: number;
  readonly when?: WhenExpression;
}
