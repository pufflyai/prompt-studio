import { TeamDashboard } from "./team-dashboard";

export default {
  title: "Proposals/PS-1376 Cloud team dashboard",
  description:
    "Desktop invitation and project access demo. Sample data only. Managed extension controls preview a later policy layer.",
  fullscreen: true,
};

export const TeamsDashboard = {
  name: "Team management demo",
  description:
    "Create an invitation as Alex, accept as Riley, then grant Project A. Switch to Morgan to try full project rights. Preview managed extensions to explore required tools.",
  render: TeamDashboard,
};
