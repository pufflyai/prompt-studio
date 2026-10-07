// Return the execution plan with its deadlines, blockers, risk, and the Planner tags tracks can use.
import { defineCommand } from "@pstdio/sdk/extensions";
import { buildPlan } from "../model/build-plan";
import { callPlanner, planner } from "../planner";
import { readActionStore } from "./action-store";
import { readArtifactNodes } from "./artifact-store";
import { readGates } from "./gate-store";
import { loadPlan } from "./plan-store";
import { readTrack } from "./track-commands";

// Deadlines are calendar days for the person reading them, so today uses the local date.
const localToday = () => new Intl.DateTimeFormat("en-CA").format(new Date());

export const readPlanCommand = defineCommand({
  id: "plan.read",
  title: "Read execution plan",
  cli: { description: "Print the execution order, deadlines, blockers, and risk as JSON." },
  async run(ctx) {
    const [loaded, { tags }] = await Promise.all([loadPlan(ctx), callPlanner(ctx, planner.readTags, {})]);
    const planTags = tags.map(({ id, name, type, options }) => ({
      id,
      name,
      type,
      options: options.map((option) => ({ id: option.id, name: option.name })),
    }));
    const [actions, gates, track, artifacts] = await Promise.all([
      readActionStore(ctx),
      readGates(ctx),
      readTrack(ctx),
      readArtifactNodes(ctx),
    ]);
    return buildPlan({ ...loaded, actions, gates, track, artifacts, tags: planTags, today: localToday() });
  },
});
