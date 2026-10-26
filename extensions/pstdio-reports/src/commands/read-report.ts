import { defineCommand, l10n, params, type ResourceIdentity } from "@pstdio/sdk/extensions";
import { readReportWithBody } from "../data/report-body";

const withIdentity = (
  report: NonNullable<Awaited<ReturnType<typeof readReportWithBody>>>,
  identity: ResourceIdentity,
) => ({
  ...report,
  shorthand: identity.shorthand,
  aliases: identity.aliases,
});

export const readReportCommand = defineCommand({
  id: "reports.read",
  title: "Read report",
  cli: { globalAliases: [["reports", "read"]], examples: ["pstdio reports read --id <report-id>"] },
  params: {
    id: params.text({ label: l10n("reports.read.id.label", "Report ID or number"), required: true }),
  },
  async run(ctx, commandParams) {
    const value = commandParams.id;
    const report = await readReportWithBody(ctx.storage, value);
    if (report) {
      const identity = await ctx.resources.identity({ kind: "report", id: report.id });
      if (!identity) throw new Error(`Core identity is missing for report "${report.id}"`);
      return withIdentity(report, identity);
    }

    const identities = await ctx.resources.findByShorthand({ kind: "report", shorthand: value.trim().toUpperCase() });
    const matches = await Promise.all(
      identities.map(async (identity) => {
        const report = await readReportWithBody(ctx.storage, identity.id);
        return report ? withIdentity(report, identity) : undefined;
      }),
    );
    const reports = matches.filter((report) => report !== undefined);
    if (!reports.length) throw new Error(`Unknown report "${value}"`);
    return reports.length === 1 ? reports[0]! : reports;
  },
});
