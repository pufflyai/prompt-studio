import type { WorkbenchExtensionDataTableRendererRecord } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import { localizeParamSchema } from "./param-schema-localization";

export const mapViewToolbarActions = (
  record: Pick<WorkbenchExtensionDataTableRendererRecord, "toolbarActions" | "extensionId">,
) =>
  record.toolbarActions?.map((action) => ({
    id: action.id,
    label: text(action.label, action.id),
    icon: action.icon,
    presentation: action.presentation,
    commandId: action.commandId,
    args: action.params,
    params: localizeParamSchema(action.input, text, record.extensionId),
    submitLabel: action.submitLabel,
    disabled: action.disabled,
    when: action.when,
  }));
