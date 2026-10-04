import type { ViewSort } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DisplaySortControl } from "./display-sort-control";

const meta: Meta<typeof DisplaySortControl> = {
  title: "Patterns/Collection View/Display Sort Control",
  component: DisplaySortControl,
};
export default meta;
type Story = StoryObj;

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
  render: () => <Ordering />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Ordering" }));
    await userEvent.click(body.getByRole("menuitem", { name: "No estimate" }));
    await expect(canvas.getByRole("button", { name: "Ordering" })).toHaveTextContent("No estimate");
    await expect(canvas.getByRole("button", { name: "Sort direction" })).toHaveTextContent("1 → 9");
    await userEvent.click(canvas.getByRole("button", { name: "Ordering" }));
    await expect(
      body.getByRole("menuitem", { name: "No estimate" }).querySelector(".lucide-check"),
    ).toBeInTheDocument();
    await userEvent.click(body.getByRole("menuitem", { name: "None", exact: true }));
    await expect(canvas.queryByRole("button", { name: "Sort direction" })).not.toBeInTheDocument();
  },
};
