import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { buildPlan } from "../model/build-plan";
import { PlanRoot } from "./plan-root";

const backgroundFailure = "This workspace has no ready local process target.";
const actionFailure = "Auto Build could not save its settings.";
const plan = {
  ...buildPlan({
    tickets: [],
    statuses: [],
    tags: [],
    today: "2026-10-15",
    plan: { deadlines: [], order: [] },
  }),
  projectId: "timeline-error-story",
  ticketRows: [],
  ticketAttributes: [],
  savedViews: { views: [], defaultViewId: null },
};
function TimelineStory(props: { failConfigure?: boolean; loading?: "tickets" | "preferences" }) {
  const { failConfigure, loading } = props;
  const respond = async (
    method: string,
    input?: {
      commandId?: string;
    },
  ) => {
    if (method === "preferences.get" && loading === "preferences") return new Promise(() => {});
    if (method === "preferences.get") return undefined;
    if (method === "preferences.set") return;
    if (method !== "commands.execute") throw new Error(`Unexpected capability: ${method}`);
    let value: unknown;
    switch (input?.commandId?.split(".command.")[1]) {
      case "timeline.plan.read":
        if (loading === "tickets") return new Promise(() => {});
        value = plan;
        break;
      case "auto-build.read":
        value = {
          enabled: false,
          prompt: "Choose small independent tickets.",
          eligible: { conjunction: "and", rules: [] },
          requireMergedDependencies: false,
          sessions: [],
          capacity: { running: 0, limit: 2 },
          error: backgroundFailure,
        };
        break;
      case "auto-build.configure":
        if (failConfigure) throw new Error(actionFailure);
        value = {};
        break;
      default:
        throw new Error(`Unexpected command: ${input?.commandId}`);
    }
    return { outcome: { ok: true, status: "success", value } };
  };
  const host: GuestHost = {
    extensionId: "pstdio.pstdio-planner",
    call: respond as GuestHost["call"],
    onEvent: () => () => {},
  };
  return (
    <Box h="600px">
      <PlanRoot host={host} t={(_key, fallback) => fallback ?? _key} />
    </Box>
  );
}
const meta: CanvasMeta<typeof TimelineStory> = {
  title: "Extensions/Planner/Timeline",
  component: TimelineStory,
};
export default meta;
type Story = CanvasFrame<typeof TimelineStory>;
export const LoadingTickets: Story = {
  id: "extensions-planner-timeline--loading-tickets",
  args: { loading: "tickets" },
};
export const LoadingPreferences: Story = {
  id: "extensions-planner-timeline--loading-preferences",
  ...LoadingTickets,
  args: { loading: "preferences" },
};
export const SavedAutoBuildFailure: Story = {
  id: "extensions-planner-timeline--saved-auto-build-failure",
};
export const ConfigureFailure: Story = {
  id: "extensions-planner-timeline--configure-failure",
  args: { failConfigure: true },
};
