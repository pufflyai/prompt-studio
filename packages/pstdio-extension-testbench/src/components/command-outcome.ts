import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import type { WorkbenchCore } from "@pstdio/workbench";

export const surfaceCommandOutcome = (workbench: WorkbenchCore, response: CommandExecuteResponse) => {
  const { outcome } = response;
  const show = (notice: Parameters<WorkbenchCore["notifications"]["show"]>[0]) =>
    workbench.notifications.show(notice, { source: "extension", ownerId: response.extensionId });

  for (const notice of outcome.notices ?? []) {
    show({
      level: notice.type,
      title: notice.title ?? "Extension notice",
      message: notice.message,
      metadata: notice.metadata,
    });
  }

  if (outcome.status === "rejected") {
    show({
      level: "warning",
      title: "Extension command rejected",
      message: outcome.reason ?? outcome.code ?? "Command was rejected by middleware.",
    });
  }

  if (outcome.status === "error") {
    show({
      level: "error",
      title: "Extension command failed",
      message: outcome.error?.message ?? outcome.reason ?? "Command threw an error.",
    });
  }
};
