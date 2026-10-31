import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ViewSort } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { DisplaySortControl } from "./display-sort-control";

const meta: CanvasMeta<typeof DisplaySortControl> = {
  title: "Patterns/Collection View/Display Sort Control",
  component: DisplaySortControl,
};
export default meta;
type Story = CanvasFrame;
const Ordering = () => {
  const [sorts, setSorts] = useState<ViewSort[]>([]);
  return (
    <DisplaySortControl
      fields={[{ id: "none", label: "No estimate", type: { kind: "number" }, sortable: true }]}
      sorts={sorts}
      onSortsChange={setSorts}
    />
  );
};
/** A legal field ID never collides with the action that clears ordering. */
export const NamedNone: Story = {
  id: "patterns-collection-view-display-sort-control--named-none",
  render: () => <Ordering />,
};
