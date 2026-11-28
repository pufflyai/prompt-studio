import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Bar } from "./collection-view-bar-story";

const meta: CanvasMeta = {
  title: "Design system/Patterns/Collection view/Filter bubble selection",
  fullscreen: true,
};
export default meta;
type Story = CanvasFrame;
export const CompleteNumberEntry: Story = {
  id: "patterns-collection-view-filter-bubble-selection--complete-number-entry",
  render: () => <Bar storageKey="preview-complete-number" />,
};
export const ChooseValueThenContinue: Story = {
  id: "patterns-collection-view-filter-bubble-selection--choose-value-then-continue",
  description: "Filter options show the number of matching records across all pages.",
  render: () => <Bar storageKey="preview-value-handoff" largeCollection />,
};
export const TextEntry: Story = {
  id: "patterns-collection-view-filter-bubble-selection--text-entry",
  render: () => <Bar storageKey="preview-text-filter-entry" />,
};
export const DateParameterFields: Story = {
  id: "patterns-collection-view-filter-bubble-selection--date-parameter-fields",
  render: () => <Bar storageKey="preview-date-parameter-fields" />,
};
