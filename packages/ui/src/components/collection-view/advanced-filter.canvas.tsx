import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Bar } from "./collection-view-bar-story";

const meta: CanvasMeta = { title: "Patterns/Collection View/Advanced Filter", parameters: { layout: "fullscreen" } };
export default meta;
type Story = CanvasVariant;
export const NestedExactDateField: Story = {
  id: "patterns-collection-view-advanced-filter--nested-exact-date-field",
  render: () => (
    <Bar
      storageKey="storybook-advanced-date-parameters"
      filter={{
        conjunction: "and",
        rules: [],
        groups: [{ conjunction: "and", rules: [{ attributeId: "updated", condition: "is", value: "2026-10-04" }] }],
      }}
    />
  ),
};
export const NormalAndAdvanced: Story = {
  id: "patterns-collection-view-advanced-filter--normal-and-advanced",
  render: () => (
    <Bar
      storageKey="storybook-normal-advanced"
      filter={{
        conjunction: "and",
        rules: [
          { attributeId: "archived", condition: "is", value: false },
          { attributeId: "priority", condition: "is-any-of", value: ["high", "medium"] },
        ],
      }}
    />
  ),
};
export const ExistingOrView: Story = {
  id: "patterns-collection-view-advanced-filter--existing-or-view",
  render: () => (
    <Bar
      storageKey="storybook-existing-or"
      filter={{
        conjunction: "or",
        rules: [
          { attributeId: "status", condition: "is-any-of", value: ["todo"] },
          { attributeId: "priority", condition: "is-any-of", value: ["high"] },
        ],
      }}
    />
  ),
};
/** One clear-all action resets normal criteria and every Advanced bubble together. */
export const ClearAllFilters: Story = {
  id: "patterns-collection-view-advanced-filter--clear-all-filters",
  render: () => (
    <Bar
      storageKey="storybook-clear-all-filters"
      filter={{
        conjunction: "and",
        rules: [{ attributeId: "status", condition: "is-any-of", value: ["todo"] }],
        groups: [{ conjunction: "or", rules: [{ attributeId: "priority", condition: "is-any-of", value: ["high"] }] }],
      }}
    />
  ),
};
export const ClearAdvancedDraft: Story = {
  id: "patterns-collection-view-advanced-filter--clear-advanced-draft",
  render: () => (
    <Bar
      storageKey="storybook-clear-advanced-draft"
      filter={{ conjunction: "and", rules: [], groups: [{ conjunction: "and", rules: [] }] }}
    />
  ),
};
