import { defineCommand, params } from "@pstdio/sdk/extensions";
import { reportsCollection } from "../data/collections";

export const readReportCommand = defineCommand({
  title: "Read report",
  cli: { globalAliases: [["reports", "read"]], examples: ["pstdio reports read --id <report-id>"] },
  params: {
    id: params.text({ label: "Report ID", required: true }),
  },
  async run(ctx) {
    const report = await reportsCollection(ctx.storage).get(ctx.params.id);
    if (!report) throw new Error(`Unknown report "${ctx.params.id}"`);
    return report;
  },
});
