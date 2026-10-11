import type { Meta, StoryObj } from "@storybook/react";
import { DEFAULT_STATUSES } from "../../data/seed";
import { AutoBuildDialog } from "./auto-build-dialog";

const meta: Meta<typeof AutoBuildDialog> = {
  title: "Extensions/Planner/Auto Build",
  component: AutoBuildDialog,
  args: {
    saving: false,
    blockOnReview: true,
    prompt: "Choose small independent tickets first.",
    ignore: {
      conjunction: "and",
      rules: [{ attributeId: "status", condition: "is-any-of", value: ["backlog", "done"] }],
    },
    data: {
      rows: [],
      attributes: [
        {
          id: "status",
          label: "Status",
          filterable: true,
          type: {
            kind: "enum",
            options: DEFAULT_STATUSES.map((status) => ({
              value: status.id,
              label: status.name,
              icon: status.icon,
              color: status.color,
            })),
          },
        },
      ],
      storageKey: "auto-build-story",
    },
    onEnable: async () => true,
    onClose: () => {},
    t: (_key, fallback) => fallback ?? _key,
  },
};
export default meta;
type Story = StoryObj<typeof AutoBuildDialog>;
export const PromptAndIgnoreFilters: Story = {};
export const EmptyPrompt: Story = { args: { prompt: "" } };
export const StackDuringReview: Story = { args: { blockOnReview: false } };
export const Saving: Story = { args: { saving: true } };
export const Failure: Story = { args: { error: "Agent unavailable" } };
