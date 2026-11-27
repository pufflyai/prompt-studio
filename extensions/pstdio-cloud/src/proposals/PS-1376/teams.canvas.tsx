import { TeamDashboard } from "./team-dashboard";

export default {
  title: "Proposals/PS-1376 Cloud team settings",
  description: "Settings → Team and Settings → Managed extensions. Synthetic demo; no live team or extension changes.",
  fullscreen: true,
};

export const TeamsDashboard = {
  name: "Team settings",
  description:
    "Open Team to invite or remove members. Open Managed extensions to select owner-controlled tools, automatically installed in team projects. Use the Viewer parameter to preview a member or invite recipient.",
  args: { viewer: "alex" },
  controls: {
    viewer: {
      type: "select",
      options: [
        { value: "alex", label: "Team owner" },
        { value: "morgan", label: "Team member" },
        { value: "riley", label: "Invite recipient" },
      ],
    },
  },
  render: TeamDashboard,
};
