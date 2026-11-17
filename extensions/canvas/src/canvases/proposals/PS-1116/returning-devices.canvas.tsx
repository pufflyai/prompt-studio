import { ReturnPopover, StatusStates } from "./cloud-status-previews";

export default {
  title: "Proposals/PS-1116 Returning devices",
  description:
    "Cloud status for a device that returns after signing out or going offline: changes kept while signed out, a large return held for review, and offline changes replaced by the devices that stayed in sync.",
};

export const StatusBarStates = {
  name: "Status bar states",
  description: "Existing states for comparison, then the three new ones. Click any state to open its popover.",
  render: StatusStates,
};

export const ReturnPopovers = {
  name: "Return popovers",
  description:
    "Pick a state. Held for review: Apply and Discard each open a confirmation. Replaced: Dismiss clears the list.",
  render: (args: { state: "Signed out · 3 changed" | "Held for review" | "Synced · 2 replaced" }) => (
    <ReturnPopover state={args.state} />
  ),
  args: { state: "Held for review" },
  controls: {
    state: {
      type: "select",
      label: "State",
      options: [
        { value: "Signed out · 3 changed", label: "Signed out with changes" },
        { value: "Held for review", label: "Held for review" },
        { value: "Synced · 2 replaced", label: "Replaced while away" },
      ],
    },
  },
};
