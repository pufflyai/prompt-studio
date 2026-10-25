import { defineCommand, params } from "@pstdio/sdk/extensions";
import { readReportWithBody } from "../data/report-body";

export const readReportCommand = defineCommand({
  id: "reports.read",
  title: "Read report",
  cli: { globalAliases: [["reports", "read"]], examples: ["pstdio reports read --id <report-id>"] },
  params: {
    id: params.text({ label: "Report ID", required: true }),
  },
  async run(ctx, commandParams) {
    const report = await readReportWithBody(ctx.storage, commandParams.id);
    if (!report) throw new Error(`Unknown report "${commandParams.id}"`);
    return report;
  },
});
