import { defineCommand, params } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { buildAnalysis } from "../analysis";
import { siteSchema } from "../schemas";
import { readSettings } from "../settings";
import { channelNames } from "../sites";
import { newest, runsOf, threadsOf } from "../store";

export const listAnalysis = defineCommand({
  id: "list-analysis",
  title: "Read the radar analysis",
  cli: true,
  params: {
    site: params.text({ description: "Count one site only." }),
    days: params.number({ description: "Days to count, 14 by default." }),
  },
  async run(ctx, { site, days }) {
    const finished = newest(
      (await runsOf(ctx).list()).filter((run) => run.status === "done"),
      (run) => run.finishedAt ?? "",
    );
    const analysis = buildAnalysis({
      threads: await threadsOf(ctx).list(),
      days: z
        .number()
        .int()
        .min(1)
        .max(90)
        .parse(days ?? 14),
      site: site ? siteSchema.parse(site) : undefined,
    });
    const { channels } = await readSettings(ctx.settings);
    // The site filter lists configured channels; names also cover threads from removed channels.
    return {
      ...analysis,
      channels: channels.map(({ id, name }) => ({ id, name })),
      channelNames: channelNames(channels),
      updatedAt: finished[0]?.finishedAt ?? null,
    };
  },
});
