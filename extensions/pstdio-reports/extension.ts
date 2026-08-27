import { defineExtension, defineSkill, defineTemplateType, packageAsset } from "@pstdio/sdk/extensions";
import { reportTemplates } from "./report-templates";
import { deleteReportCommand } from "./src/commands/delete-report";
import { readReportCommand } from "./src/commands/read-report";
import { saveReportCommand } from "./src/commands/save-report";
import { reportTemplateCommands } from "./src/commands/template-commands";
import { writeReportCommand } from "./src/commands/write-report";

const reportTemplateCommandRefs = {
  list: reportTemplateCommands.list.ref,
  read: reportTemplateCommands.read.ref,
  save: reportTemplateCommands.save.ref,
  delete: reportTemplateCommands.delete.ref,
};

export default defineExtension({
  commands: [
    writeReportCommand,
    readReportCommand,
    saveReportCommand,
    deleteReportCommand,
    ...Object.values(reportTemplateCommands),
  ],
  templateTypes: [
    defineTemplateType({
      id: "report",
      label: "Report",
      description: "Report templates",
      order: 40,
      commands: reportTemplateCommandRefs,
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
