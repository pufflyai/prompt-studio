import { defineExtension, defineSkill, defineTemplateType, packageAsset } from "@pstdio/sdk/extensions";
import { reportTemplates } from "./report-templates";
import { deleteReportCommand } from "./src/commands/delete-report";
import { readReportCommand } from "./src/commands/read-report";
import { saveReportCommand } from "./src/commands/save-report";
import { writeReportCommand } from "./src/commands/write-report";

export default defineExtension({
  commands: [writeReportCommand, readReportCommand, saveReportCommand, deleteReportCommand],
  templateTypes: [
    defineTemplateType({
      id: "report",
      label: "Report",
      description: "Report templates",
    }),
  ],
  templates: reportTemplates,
  skills: [
    defineSkill({
      id: "use_reports",
      title: "Use reports",
      source: packageAsset("./skills/use-reports", import.meta.url),
    }),
  ],
});
