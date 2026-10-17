import { Box } from "@chakra-ui/react";
import type { GuestHost } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  const respond = async (method: string, input?: { commandId?: string }) => {
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
          ignore: { conjunction: "and", rules: [] },
          blockOnReview: true,
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

const meta: Meta<typeof TimelineStory> = {
  title: "Extensions/Planner/Timeline",
  component: TimelineStory,
};
export default meta;
type Story = StoryObj<typeof TimelineStory>;

export const LoadingTickets: Story = {
  args: { loading: "tickets" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByRole("button", { name: "Filter" })).toBeDisabled();
    expect(canvas.getByRole("button", { name: "Auto Build" })).toBeDisabled();
    expect(canvas.getByRole("region", { name: "Loading timeline" })).toHaveAttribute("aria-busy", "true");
  },
};

export const LoadingPreferences: Story = { ...LoadingTickets, args: { loading: "preferences" } };

export const SavedAutoBuildFailure: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const button = await page.findByRole("button", { name: "Auto Build" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(page.queryByRole("alert")).toBeNull();
    await userEvent.click(button);
    expect(await page.findByRole("alert")).toHaveTextContent(backgroundFailure);
    const popover = page.getByRole("dialog");
    await userEvent.click(within(popover).getByRole("button", { name: "Auto Build" }));
    await page.findByRole("dialog", { name: "Auto Build" });
    expect(page.queryByRole("alert")).toBeNull();
  },
};

export const ConfigureFailure: Story = {
  args: { failConfigure: true },
  play: async (context) => {
    await SavedAutoBuildFailure.play!(context);
    const page = within(context.canvasElement.ownerDocument.body);
    const dialog = page.getByRole("dialog", { name: "Auto Build" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Auto Build" }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent(actionFailure));
    expect(page.getAllByRole("alert")).toHaveLength(1);
  },
};
