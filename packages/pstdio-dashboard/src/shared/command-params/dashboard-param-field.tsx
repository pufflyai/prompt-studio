import type { WorkbenchCore } from "@pstdio/workbench";
import type { CommandParamFieldProps } from "@pstdio/workbench/react";
import { HarnessParamField } from "./harness-param-field";
import { RepoParamField } from "./repo-param-field";
import { TemplateParamField } from "./template-param-field";

// Maps the host-specific param types the workbench cannot render to dashboard
// selectors backed by project data. Other types fall back to the built-in field.
export const createDashboardParamFieldRenderer = (workbench: WorkbenchCore) => (props: CommandParamFieldProps) => {
  if (props.entry.type === "harness") return <HarnessParamField workbench={workbench} {...props} />;
  if (props.entry.type === "repo") return <RepoParamField workbench={workbench} {...props} />;
  if (props.entry.type === "template") return <TemplateParamField workbench={workbench} {...props} />;
  return undefined;
};
