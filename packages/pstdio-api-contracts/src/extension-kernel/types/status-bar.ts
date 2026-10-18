import type { ContributionDefinition, StatusBarSlotRef, ViewRef } from "./contribution-identity";
import type { WhenExpression } from "./contributions";

export interface StatusBarItemContribution extends ContributionDefinition<"status-bar-item"> {
  readonly view: ViewRef;
  readonly slot: StatusBarSlotRef;
  readonly order?: number;
  readonly when?: WhenExpression;
}
