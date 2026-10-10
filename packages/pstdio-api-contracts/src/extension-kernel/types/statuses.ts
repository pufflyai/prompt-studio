import type { Localizable } from "../l10n";
import type { ExtensionContextBase } from "./context";
import type { ContributionDefinition, StatusBarSlotRef, ViewRef } from "./contribution-identity";
import type { WhenExpression } from "./contributions";
import type { MaybePromise } from "./json";

/** @deprecated Use extension-owned domain records and `KanbanRendererEnumOption` for collection rendering. */
export interface WorkflowStatus {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly icon?: string | null;
  readonly sortOrder: number;
  readonly isDefault?: boolean;
  readonly actions?: readonly string[];
}

/** @deprecated Use `KanbanRendererColumnAction` in query-owned `boardColumnConfigs` and extension-owned editor choices. */
export interface StatusActionDefinition {
  readonly id: string;
  readonly label: Localizable<string>;
  readonly icon?: string;
}

/** @deprecated Use extension-owned values and commands, a settings panel, and query-returned enum attributes. */
export interface StatusContribution extends ContributionDefinition<"status"> {
  readonly title: Localizable<string>;
  readonly actions?: readonly StatusActionDefinition[];
  readonly query: (
    ctx: ExtensionContextBase,
    input: Record<string, never>,
  ) => MaybePromise<{ statuses: readonly WorkflowStatus[] }>;
  readonly save?: (
    ctx: ExtensionContextBase,
    input: { statuses: readonly WorkflowStatus[] },
  ) => MaybePromise<{ statuses: readonly WorkflowStatus[] }>;
}

export interface StatusBarItemContribution extends ContributionDefinition<"status-bar-item"> {
  readonly view: ViewRef;
  readonly slot: StatusBarSlotRef;
  readonly order?: number;
  readonly when?: WhenExpression;
}
