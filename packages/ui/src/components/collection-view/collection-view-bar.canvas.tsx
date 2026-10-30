import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { CollectionViewBar } from "./collection-view-bar";
import { Bar } from "./collection-view-bar-story";
import { storyFilter } from "./collection-view-story-fixtures";

const meta: CanvasMeta<typeof CollectionViewBar> = {
  title: "Patterns/Collection View/Collection View Bar",
  component: CollectionViewBar,
  fullscreen: true,
};
export default meta;
type Story = CanvasVariant;
export const UserOwnedViews: Story = {
  id: "patterns-collection-view-collection-view-bar--user-owned-views",
  render: () => <Bar storageKey="preview-user-owned-views" filter={storyFilter} />,
};
/** Persisted JSON can return sort keys in a different order without changing the view. */
export const SavedSorts: Story = {
  id: "patterns-collection-view-collection-view-bar--saved-sorts",
  render: () => <Bar storageKey="preview-saved-sorts" editedSorts={[{ attributeId: "title", direction: "asc" }]} />,
};
/** Text editing stays centered in the bubble, including characters with descenders. */
export const TextFilterEditing: Story = {
  id: "patterns-collection-view-collection-view-bar--text-filter-editing",
  render: () => <Bar storageKey="preview-text-filter-editing" />,
};
export const NoRules: Story = {
  id: "patterns-collection-view-collection-view-bar--no-rules",
  render: () => <Bar storageKey="preview-collection-view-bar-no-rules" />,
};
/** Saved rules always show in the criteria row, so nothing that hides rows is invisible. */
export const RulesSaved: Story = {
  id: "patterns-collection-view-collection-view-bar--rules-saved",
  render: () => (
    <Bar
      storageKey="preview-collection-view-bar-saved"
      filter={storyFilter}
      sorts={[{ attributeId: "priority", direction: "asc" }]}
    />
  ),
};
/** The toolbar picker reflects existing exclusions. */
export const SharedPropertyPicker: Story = {
  id: "patterns-collection-view-collection-view-bar--shared-property-picker",
  render: () => <Bar storageKey="preview-shared-property-picker" filter={storyFilter} />,
};
/** Selecting several values keeps the toolbar picker open. */
export const PickerSelection: Story = {
  id: "patterns-collection-view-collection-view-bar--picker-selection",
  render: () => <Bar storageKey="preview-picker-handoff" filter={storyFilter} />,
};
/** An edit marks the tab and offers Reset and Save until the view is saved. */
export const UnsavedChanges: Story = {
  id: "patterns-collection-view-collection-view-bar--unsaved-changes",
  render: () => (
    <Bar
      storageKey="preview-collection-view-bar-unsaved"
      filter={storyFilter}
      editedSorts={[{ attributeId: "score", direction: "desc" }]}
    />
  ),
};
/** Search is screen state: it never marks the view as changed. */
export const SearchOpen: Story = {
  id: "patterns-collection-view-collection-view-bar--search-open",
  render: () => <Bar storageKey="preview-collection-view-bar-search" filter={storyFilter} />,
};
/** Booleans name a predicate; the operator selects its truth value. */
export const BooleanPredicate: Story = {
  id: "patterns-collection-view-collection-view-bar--boolean-predicate",
  render: () => (
    <Bar
      storageKey="preview-collection-view-boolean"
      filter={{ conjunction: "and", rules: [{ attributeId: "archived", condition: "is", value: false }] }}
    />
  ),
};
/** Both sort directions remain visible inside Display, which owns one ordering. */
export const NestedSortChoices: Story = {
  id: "patterns-collection-view-collection-view-bar--nested-sort-choices",
  render: () => <Bar storageKey="preview-sort-choices" sorts={[{ attributeId: "updated", direction: "desc" }]} />,
};
/** Property, condition, and value are independent controls; values toggle without closing. */
export const IndependentFilterChoices: Story = {
  id: "patterns-collection-view-collection-view-bar--independent-filter-choices",
  render: () => (
    <Bar
      storageKey="preview-independent-filter-choices"
      filter={{ conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["todo"] }] }}
    />
  ),
};
/** Imported empty predicates keep their meaning until a real value is chosen. */
export const EmptyOptionPredicate: Story = {
  id: "patterns-collection-view-collection-view-bar--empty-option-predicate",
  render: () => (
    <Bar
      storageKey="preview-empty-option-predicate"
      filter={{ conjunction: "and", rules: [{ attributeId: "status", condition: "is-empty" }] }}
    />
  ),
};
/** Incoming all-value rules stay explicit and retain their condition while values change. */
export const AllValuesPredicate: Story = {
  id: "patterns-collection-view-collection-view-bar--all-values-predicate",
  render: () => (
    <Bar
      storageKey="preview-all-values-predicate"
      filter={{ conjunction: "and", rules: [{ attributeId: "labels", condition: "has-all-of", value: ["bug"] }] }}
    />
  ),
};
