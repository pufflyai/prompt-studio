import type { WorkbenchCollectionScope } from "../favorites/favorite-registry";
import type { ResourceRef } from "../resources/resource-registry";

export type SavedViewFilterOperator =
  | "is"
  | "isNot"
  | "in"
  | "notIn"
  | "contains"
  | "isEmpty"
  | "isNotEmpty"
  | "before"
  | "after"
  | "within";

export type FilterExpression =
  | { op: "and" | "or"; children: FilterExpression[] }
  | { field: string; operator: SavedViewFilterOperator; value?: unknown };

export type ViewDisplayLayout = "table" | "list" | "board" | "timeline" | "grid";

export interface ViewDisplayOptions {
  layout: ViewDisplayLayout;
  columns?: string[];
  sort?: { field: string; direction: "asc" | "desc" }[];
  groupBy?: string[];
  hiddenFields?: string[];
  density?: "compact" | "comfortable";
  cardFields?: string[];
  board?: { columnField: string; hiddenColumns?: string[] };
}

export interface SavedViewField {
  id: string;
  label: string;
  type: "string" | "number" | "boolean" | "date" | "enum" | "user";
  operators: readonly SavedViewFilterOperator[];
  options?: readonly { value: string; label: string }[];
}

export type ValidationResult = { valid: true } | { valid: false; reason?: string };

export interface WorkbenchSavedView {
  id: string;
  name: string;
  description?: string;
  resourceKind: string;
  filter: FilterExpression;
  display: ViewDisplayOptions;
  scope: WorkbenchCollectionScope;
  projectId?: string;
  order?: number;
  schemaVersion: number;
  invalid?: "kind" | "filter" | "display" | "migration";
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedViewInput {
  name: string;
  description?: string;
  resourceKind: string;
  filter: FilterExpression;
  display: ViewDisplayOptions;
  scope: WorkbenchCollectionScope;
  projectId?: string;
  order?: number;
}

export type UpdateSavedViewInput = Partial<Omit<CreateSavedViewInput, "resourceKind" | "scope">>;

export interface SavedViewListInput {
  scope?: WorkbenchCollectionScope;
  projectId?: string;
  resourceKind?: string;
}

export interface ResolveSavedViewQueryInput {
  view: WorkbenchSavedView;
  filter: FilterExpression;
  display: ViewDisplayOptions;
}

export interface ResolvedSavedViewQuery {
  rows: unknown[];
}

export interface SavedViewKindContribution {
  kind: string;
  label: string;
  icon?: string;
  fields: readonly SavedViewField[];
  layouts: readonly ViewDisplayLayout[];
  defaultFilter?: FilterExpression;
  defaultDisplay: ViewDisplayOptions;
  currentSchemaVersion?: number;
  validateFilter?(filter: FilterExpression): ValidationResult;
  migrate?(view: WorkbenchSavedView): WorkbenchSavedView;
  resolveQuery(input: ResolveSavedViewQueryInput): Promise<ResolvedSavedViewQuery>;
  createResource(view: WorkbenchSavedView): ResourceRef;
}
