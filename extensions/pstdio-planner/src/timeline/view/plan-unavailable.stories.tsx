import type { Meta, StoryObj } from "@storybook/react";
import { PlanUnavailable } from "./plan-unavailable";

const meta: Meta<typeof PlanUnavailable> = {
  title: "Extensions/Planner/Timeline/Unavailable",
  component: PlanUnavailable,
  args: { t: (_key: string, fallback?: string) => fallback ?? _key },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const MultiSelectTrack: Story = {
  args: {
    message:
      "Track must be a single-select property. In Settings > Project > Ticket tags, set Track to Single. Tickets with more than one Track value must keep one value first.",
  },
};

export const SeveralTrackProperties: Story = {
  args: {
    message:
      "Several properties are named Track. In Settings > Project > Ticket tags, rename or delete the extra ones so one Track property remains.",
  },
};
