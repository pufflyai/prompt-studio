// Create and rename product tracks and change one ticket's Track property through Planner.
import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { trackProperty } from "../model/tracks";
import { callPlanner, type PlannerTicket, planner } from "../planner";
import { withWriteGuard } from "./write-guard";

export async function readTrack(ctx: CommandContext) {
  const { tags } = await callPlanner(ctx, planner.readTags, {});
  const binding = await ctx.storage.get<string>("track-property-id");
  if (!binding) {
    return trackProperty(tags);
  }
  const property = tags.find(({ id }) => id === binding);
  if (property?.type !== "single_select") {
    throw new Error("The bound Track property is missing or no longer single-select. Restore it in Planner settings.");
  }
  return property;
}

export async function assignTrack(ctx: CommandContext, ticket: PlannerTicket, trackId: string) {
  const property = await readTrack(ctx);
  if (!property && !trackId) {
    return ticket;
  }
  if (!property || (trackId && !property.options.some(({ id }) => id === trackId))) {
    throw new Error("Unknown track. Reload the available tracks.");
  }

  await ctx.storage.set("track-property-id", property.id);
  const result = await callPlanner(ctx, planner.setAttribute, {
    rowId: ticket.id,
    attributeId: property.id,
    value: trackId,
  });
  if (!result) {
    throw new Error("The ticket no longer exists.");
  }
  return result;
}

export const createTrackCommand = defineCommand({
  id: "track.create",
  title: "Create feature track",
  cli: { description: "Create a value in the dedicated single-select Track property." },
  mutating: true,
  params: { name: params.text({ required: true }) },
  async run(ctx, { name }) {
    return withWriteGuard(ctx, "tracks", async () => {
      const label = name.trim();
      if (!label) {
        throw new Error("A track name is required.");
      }
      const property =
        (await readTrack(ctx)) ?? (await callPlanner(ctx, planner.createTag, { name: "Track", type: "single_select" }));
      if (property.options.some((option) => option.name.toLowerCase() === label.toLowerCase())) {
        throw new Error("That track already exists.");
      }
      await ctx.storage.set("track-property-id", property.id);
      return callPlanner(ctx, planner.createOption, { tagId: property.id, name: label });
    });
  },
});

export const assignTrackCommand = defineCommand({
  id: "track.assign",
  title: "Assign feature track",
  cli: { description: "Assign a ticket to a track. Use none to clear it." },
  mutating: true,
  params: { ticket: params.text({ required: true }), track: params.text({ required: true }) },
  async run(ctx, { ticket, track }) {
    const current = await callPlanner(ctx, planner.getTicket, { id: ticket });
    if (!current) {
      throw new Error("Unknown ticket.");
    }
    return withWriteGuard(ctx, current.id, () => assignTrack(ctx, current, track === "none" ? "" : track));
  },
});

export const renameTrackCommand = defineCommand({
  id: "track.rename",
  title: "Rename feature track",
  cli: { description: "Rename a value of the Track property. Its tickets keep the track." },
  mutating: true,
  params: { track: params.text({ required: true }), name: params.text({ required: true }) },
  async run(ctx, { track, name }) {
    return withWriteGuard(ctx, "tracks", async () => {
      const label = name.trim();
      if (!label) {
        throw new Error("A track name is required.");
      }
      const property = await readTrack(ctx);
      if (!property?.options.some(({ id }) => id === track)) {
        throw new Error("Unknown track. Reload the available tracks.");
      }
      if (property.options.some((option) => option.id !== track && option.name.toLowerCase() === label.toLowerCase())) {
        throw new Error("That track already exists.");
      }
      return callPlanner(ctx, planner.updateOption, { tagId: property.id, optionId: track, name: label });
    });
  },
});
