import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import { reportTemplates } from "./report-templates";
import { deleteReportCommand } from "./src/commands/delete-report";
import { saveReportCommand } from "./src/commands/save-report";
import { writeReportCommand } from "./src/commands/write-report";

export default defineExtension({
  commands: {
    "reports.write": writeReportCommand,
    "reports.save": saveReportCommand,
    "reports.delete": deleteReportCommand,
  },
  templateTypes: {
    report: {
      label: "Report",
      description: "Report templates",
    },
  },
  templates: reportTemplates,
  skills: {
    use_reports: {
      title: "Use reports",
      source: packageAsset("./skills/use-reports", import.meta.url),
    },
  },
});
