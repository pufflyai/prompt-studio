// Create artifact nodes, attach a published prototype to existing work, and load its current preview.
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { artifacts } from "../artifacts";
import { planChanged } from "../contracts";
import { callPlanner, planner } from "../planner";
import { artifactNodes } from "./artifact-store";
import { createPlacedTicket } from "./create-ticket";
import { gates } from "./gate-store";

export const listArtifactsCommand = defineCommand({
  id: "artifact.list",
  title: "List timeline artifacts",
  cli: true,
  params: {},
  run: (ctx) => callPlanner(ctx, artifacts.list, {}),
});

export const createArtifactCommand = defineCommand({
  id: "artifact.create",
  title: "Create artifact node",
  cli: true,
  mutating: true,
  params: {
    title: params.text({ required: true }),
    url: params.text({ required: true }),
    description: params.longText(),
    track: params.text(),
    deadline: params.text(),
    dependsOn: params.list(),
  },
  async run(ctx, input) {
    const title = input.title.trim();
    if (!title) {
      throw new Error("An artifact node needs a title.");
    }
    const artifact = await callPlanner(ctx, artifacts.read, { url: input.url });
    const result = await createPlacedTicket(ctx, {
      title,
      content: `# ${title}\n\n${input.description ?? ""}`,
      track: input.track,
      deadline: input.deadline,
      dependsOn: input.dependsOn,
    });
    await artifactNodes(ctx).put(result.ticket.id, { ticketId: result.ticket.id, url: artifact.url });
    await ctx.events.emit(planChanged, { reason: "artifact-created" });
    return result;
  },
});

export const attachArtifactCommand = defineCommand({
  id: "artifact.attach",
  title: "Link timeline artifact",
  cli: true,
  mutating: true,
  params: { ticket: params.text({ required: true }), url: params.text({ required: true }) },
  async run(ctx, { ticket, url }) {
    const current = await callPlanner(ctx, planner.getTicket, { id: ticket });
    if (!current) {
      throw new Error("Unknown ticket.");
    }
    if (await gates(ctx).get(current.id)) {
      throw new Error("An agent gate cannot also be an artifact node.");
    }
    if (url === "none") {
      await artifactNodes(ctx).delete(current.id);
    } else {
      const artifact = await callPlanner(ctx, artifacts.read, { url });
      await artifactNodes(ctx).put(current.id, { ticketId: current.id, url: artifact.url });
    }
    await ctx.events.emit(planChanged, { reason: "artifact-linked" });
    return { ticketId: current.id };
  },
});

export const previewArtifactCommand = defineCommand({
  id: "artifact.preview",
  title: "Preview timeline artifact",
  cli: true,
  params: { ticket: params.text({ required: true }) },
  async run(ctx, { ticket }) {
    const current = await callPlanner(ctx, planner.getTicket, { id: ticket });
    const link = current && (await artifactNodes(ctx).get(current.id));
    if (!link) {
      throw new Error("This ticket has no linked artifact.");
    }
    const artifact = await callPlanner(ctx, artifacts.read, { url: link.url });
    return { html: artifact.html, revisionId: artifact.revisionId };
  },
});
