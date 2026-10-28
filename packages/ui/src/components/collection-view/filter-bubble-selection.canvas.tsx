import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Bar } from "./collection-view-bar-story";

const meta: CanvasMeta = {
  title: "Patterns/Collection View/Filter Bubble Selection",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = CanvasVariant;
export const CompleteNumberEntry: Story = {
  id: "patterns-collection-view-filter-bubble-selection--complete-number-entry",
  render: () => <Bar storageKey="storybook-complete-number" />,
};
export const ChooseValueThenContinue: Story = {
  id: "patterns-collection-view-filter-bubble-selection--choose-value-then-continue",
  render: () => <Bar storageKey="storybook-value-handoff" />,
};
export const TextEntry: Story = {
  id: "patterns-collection-view-filter-bubble-selection--text-entry",
  render: () => <Bar storageKey="storybook-text-filter-entry" />,
};
export const DateParameterFields: Story = {
  id: "patterns-collection-view-filter-bubble-selection--date-parameter-fields",
  render: () => <Bar storageKey="storybook-date-parameter-fields" />,
};
