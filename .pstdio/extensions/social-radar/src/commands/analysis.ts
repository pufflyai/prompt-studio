import { defineCommand, params } from "@pstdio/sdk/extensions";
import { buildAnalysis } from "../analysis";
import { siteSchema } from "../schemas";
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
      (await runsOf(ctx).list()).filter((run) => run.finishedAt),
      (run) => run.finishedAt ?? "",
    );
    const analysis = buildAnalysis({
      threads: await threadsOf(ctx).list(),
      days: days ?? 14,
      site: site ? siteSchema.parse(site) : undefined,
    });
    return { ...analysis, updatedAt: finished[0]?.finishedAt ?? null };
  },
});
