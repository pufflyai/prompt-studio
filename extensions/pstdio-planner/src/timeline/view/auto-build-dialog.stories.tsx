import type { Meta, StoryObj } from "@storybook/react";
import { AutoBuildDialog } from "./auto-build-dialog";

const meta: Meta<typeof AutoBuildDialog> = {
  title: "Extensions/Planner/Auto Build",
  component: AutoBuildDialog,
  args: {
    saving: false,
    fields: [
      { id: "title", label: "Title", type: { kind: "string" }, filterable: true },
      {
        id: "status",
        label: "Status",
        filterable: true,
        type: { kind: "enum", options: [{ value: "todo", label: "Todo" }] },
      },
    ],
    filter: {
      conjunction: "and",
      rules: [
        { attributeId: "status", condition: "is-any-of", value: ["todo"] },
        { attributeId: "title", condition: "contains", value: "Release" },
      ],
    },
    onEnable: async () => true,
    onClose: () => {},
    t: (_key, fallback) => fallback ?? _key,
  },
};
export default meta;
type Story = StoryObj<typeof AutoBuildDialog>;
export const CurrentFilters: Story = {};
export const AllTickets: Story = { args: { filter: { conjunction: "and", rules: [] } } };
export const Saving: Story = { args: { saving: true } };
export const Failure: Story = { args: { error: "Agent unavailable" } };
